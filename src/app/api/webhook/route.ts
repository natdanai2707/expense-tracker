import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabase, addExpense, getMonthlySummary, CATEGORIES, type CategoryId } from "@/lib/supabase";
import { parseTextExpense, ocrReceiptImage, buildReportText } from "@/lib/parser";

const pending = new Map<string, any>();

const ALL_CATS: Record<string, { label: string; color: string }> = {
  personal:    { label: "ส่วนตัว",      color: "#6366f1" },
  with_layers: { label: "WITH LAYERS",   color: "#f59e0b" },
  met:         { label: "MET Furniture", color: "#10b981" },
  steel_s2000: { label: "S-2000",        color: "#ef4444" },
  south_steel: { label: "เหล็กใต้",      color: "#f97316" },
  other:       { label: "อื่นๆ",         color: "#8b5cf6" },
};

const DEFAULT_CATS = ["personal", "other"];

async function getGroupCategories(groupId: string): Promise<string[]> {
  const { data } = await supabase.from("group_config").select("categories").eq("group_id", groupId).single();
  return data?.categories || DEFAULT_CATS;
}

async function ensureGroupConfig(groupId: string) {
  const { data } = await supabase.from("group_config").select("group_id").eq("group_id", groupId).single();
  if (!data) {
    await supabase.from("group_config").insert({ group_id: groupId, name: "กลุ่มของฉัน", categories: DEFAULT_CATS });
  }
}

function verify(body: string, sig: string) {
  const hmac = crypto.createHmac("SHA256", process.env.LINE_CHANNEL_SECRET!).update(body).digest("base64");
  return hmac === sig;
}

async function reply(token: string, messages: any[]) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify({ replyToken: token, messages }),
  });
}

async function push(to: string, messages: any[]) {
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify({ to, messages }),
  });
}

async function getProfile(userId: string): Promise<string> {
  const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
    headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
  });
  if (!res.ok) return "Unknown";
  return (await res.json()).displayName || "Unknown";
}

async function getImage(msgId: string): Promise<{ base64: string; mediaType: string } | null> {
  const res = await fetch(`https://api-data.line.me/v2/bot/message/${msgId}/content`, {
    headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
  });
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  return { base64: Buffer.from(buf).toString("base64"), mediaType: res.headers.get("content-type") || "image/jpeg" };
}

function buildFlexMessage(item: any, tempId: string, groupCats: string[]) {
  const catLabel = ALL_CATS[item.category]?.label || "อื่นๆ";

  // Split categories into rows of 3
  const rows: string[][] = [];
  for (let i = 0; i < groupCats.length; i += 3) rows.push(groupCats.slice(i, i + 3));

  return {
    type: "flex",
    altText: `${item.vendor} ${Number(item.amount).toLocaleString("th-TH")} บาท`,
    contents: {
      type: "bubble",
      styles: { body: { backgroundColor: "#ffffff" }, footer: { backgroundColor: "#f8f8f8" } },
      body: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "20px",
        contents: [
          { type: "text", text: item.vendor, weight: "bold", size: "lg", color: "#111111" },
          { type: "text", text: `${Number(item.amount).toLocaleString("th-TH")} บาท`, size: "xxl", weight: "bold", color: "#6366f1", margin: "xs" },
          { type: "separator", margin: "md" },
          { type: "box", layout: "horizontal", margin: "md", contents: [
            { type: "text", text: "หมวด", size: "sm", color: "#888888", flex: 2 },
            { type: "text", text: catLabel, size: "sm", color: "#111111", flex: 3, weight: "bold" },
          ]},
          ...(item.sub_category ? [{ type: "box", layout: "horizontal", contents: [
            { type: "text", text: "หมวดย่อย", size: "sm", color: "#888888", flex: 2 },
            { type: "text", text: item.sub_category, size: "sm", color: "#111111", flex: 3, weight: "bold" },
          ]}] : []),
          { type: "separator", margin: "md" },
          { type: "text", text: "เปลี่ยนหมวด:", size: "xs", color: "#aaaaaa", margin: "md" },
          ...rows.map(row => ({
            type: "box", layout: "horizontal", spacing: "xs", margin: "xs",
            contents: row.map(id => ({
              type: "button", height: "sm", flex: 1,
              style: id === item.category ? "primary" : "secondary",
              action: { type: "postback", label: ALL_CATS[id]?.label || id, data: `action=cat&id=${tempId}&cat=${id}`, displayText: ALL_CATS[id]?.label || id },
            })),
          })),
        ],
      },
      footer: {
        type: "box", layout: "horizontal", spacing: "sm", paddingAll: "14px",
        contents: [
          { type: "button", style: "secondary", flex: 1, height: "sm", action: { type: "postback", label: "ยกเลิก", data: `action=cancel&id=${tempId}`, displayText: "ยกเลิก" } },
          { type: "button", style: "primary", flex: 2, height: "sm", color: "#6366f1", action: { type: "postback", label: "บันทึก", data: `action=save&id=${tempId}`, displayText: "บันทึก" } },
        ],
      },
    },
  };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("x-line-signature") || "";
  if (!verify(rawBody, sig)) return NextResponse.json({ error: "Invalid signature" }, { status: 403 });

  const { events = [] } = JSON.parse(rawBody);

  for (const event of events) {
    const { replyToken, source, type, message, postback } = event;
    const userId = source?.userId || "unknown";
    const groupId = source?.groupId || source?.roomId || userId;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    try {
      if (type === "message" && message?.type === "text") {
        const text = message.text.trim();

        if (text === "/report" || text === "/สรุป") {
          const summary = await getMonthlySummary(undefined, groupId);
          await reply(replyToken, [{ type: "text", text: buildReportText(summary) }]);
          continue;
        }
        if (text === "/link" || text === "/dashboard") {
          await reply(replyToken, [{ type: "text", text: `Dashboard: ${appUrl}/g/${groupId}` }]);
          continue;
        }
        if (text === "/help" || text === "/คู่มือ") {
          await reply(replyToken, [{ type: "text", text: `วิธีใช้งาน\n\nถ่ายรูปใบเสร็จ → Bot อ่านอัตโนมัติ\n\nพิมพ์รายการ เช่น:\n"ค่าน้ำมัน 450"\n"Kerry 1200"\n\n/report → สรุปเดือนนี้\n/link → Dashboard กลุ่มนี้` }]);
          continue;
        }

        const userPendingKey = Array.from(pending.keys()).find(k => k.startsWith(`${userId}_`) && pending.get(k).awaitingEdit);
        if (userPendingKey) {
          const item = pending.get(userPendingKey);
          const amountMatch = text.match(/^(\d+(?:\.\d{1,2})?)$/);
          if (amountMatch) { item.amount = parseFloat(amountMatch[1]); }
          else if (!text.startsWith("/")) { item.vendor = text; }
          item.awaitingEdit = false;
          pending.set(userPendingKey, item);
          const groupCats = await getGroupCategories(groupId);
          await reply(replyToken, [buildFlexMessage(item, userPendingKey, groupCats) as any]);
          continue;
        }

        const parsed = parseTextExpense(text);
        if (parsed && parsed.amount > 0) {
          await ensureGroupConfig(groupId);
          const groupCats = await getGroupCategories(groupId);
          // If parsed category not in group's cats, default to first cat
          if (!groupCats.includes(parsed.category)) parsed.category = groupCats[0] as CategoryId;

          const tempId = `${userId}_${Date.now()}`;
          const name = await getProfile(userId);
          pending.set(tempId, { ...parsed, added_by: name, line_user_id: userId, group_id: groupId, replyTarget: groupId, awaitingEdit: false });
          setTimeout(() => pending.delete(tempId), 5 * 60 * 1000);
          await reply(replyToken, [buildFlexMessage(parsed, tempId, groupCats) as any]);
        } else {
          await reply(replyToken, [{ type: "text", text: `ไม่เข้าใจรายการนี้ครับ\n\nตัวอย่าง: "ค่าน้ำมัน 450"\nหรือถ่ายรูปใบเสร็จมาได้เลย\n\n/help ดูคู่มือ` }]);
        }
      }

      if (type === "message" && message?.type === "image") {
        await reply(replyToken, [{ type: "text", text: "กำลังอ่านใบเสร็จ..." }]);
        const img = await getImage(message.id);
        if (!img) { await push(groupId, [{ type: "text", text: "ดาวน์โหลดรูปไม่ได้ครับ ลองส่งใหม่" }]); continue; }

        const parsed = await ocrReceiptImage(img.base64, img.mediaType);
        if (!parsed || parsed.amount <= 0) {
          await push(groupId, [{ type: "text", text: "อ่านใบเสร็จไม่ชัดครับ ลองพิมพ์เองได้เลย" }]);
          continue;
        }

        await ensureGroupConfig(groupId);
        const groupCats = await getGroupCategories(groupId);
        if (!groupCats.includes(parsed.category)) parsed.category = groupCats[0] as CategoryId;

        const tempId = `${userId}_${Date.now()}`;
        const name = await getProfile(userId);
        pending.set(tempId, { ...parsed, added_by: name, line_user_id: userId, group_id: groupId, replyTarget: groupId, awaitingEdit: false });
        setTimeout(() => pending.delete(tempId), 5 * 60 * 1000);
        await push(groupId, [buildFlexMessage(parsed, tempId, groupCats) as any]);
      }

      if (type === "postback") {
        const params = new URLSearchParams(postback.data);
        const action = params.get("action");
        const tempId = params.get("id");

        if (!tempId || !pending.has(tempId)) {
          await reply(replyToken, [{ type: "text", text: "รายการหมดอายุแล้วครับ กรุณาส่งใหม่" }]);
          continue;
        }

        const item = pending.get(tempId);
        const itemTarget = item.replyTarget || groupId;
        const groupCats = await getGroupCategories(item.group_id || groupId);

        if (action === "cat") {
          item.category = params.get("cat") as CategoryId;
          item.awaitingEdit = false;
          if (item.category !== "personal") item.sub_category = "";
          pending.set(tempId, item);
          await reply(replyToken, [buildFlexMessage(item, tempId, groupCats) as any]);
        }

        if (action === "save") {
          await addExpense({
            date: item.date || new Date().toISOString().split("T")[0],
            vendor: item.vendor, amount: item.amount,
            category: item.category, sub_category: item.sub_category || "",
            note: item.note || "", added_by: item.added_by,
            line_user_id: item.line_user_id, group_id: item.group_id || groupId,
            type: item.type || "expense",
            income_category: item.income_category || "",
          });
          pending.delete(tempId);
          const cat = ALL_CATS[item.category];
          const subLine = item.sub_category ? ` (${item.sub_category})` : "";
          await push(itemTarget, [{ type: "text", text: `บันทึกแล้วครับ!\n\n${item.vendor}\n${Number(item.amount).toLocaleString("th-TH")} บาท\n${cat?.label || item.category}${subLine}` }]);
        }

        if (action === "cancel") {
          pending.delete(tempId);
          await reply(replyToken, [{ type: "text", text: "ยกเลิกแล้วครับ" }]);
        }
      }
    } catch (err) {
      console.error("Webhook error:", err);
      try { await reply(replyToken, [{ type: "text", text: "เกิดข้อผิดพลาด กรุณาลองใหม่ครับ" }]); } catch {}
    }
  }

  return NextResponse.json({ ok: true });
}