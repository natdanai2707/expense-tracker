import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { addExpense, getMonthlySummary, CATEGORIES, type CategoryId } from "@/lib/supabase";
import { parseTextExpense, ocrReceiptImage, buildFlexMessage, buildReportText } from "@/lib/parser";

const pending = new Map<string, any>();

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

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("x-line-signature") || "";
  if (!verify(rawBody, sig)) return NextResponse.json({ error: "Invalid signature" }, { status: 403 });

  const { events = [] } = JSON.parse(rawBody);

  for (const event of events) {
    const { replyToken, source, type, message, postback } = event;
    const userId = source?.userId || "unknown";
    const groupTarget = source?.groupId || source?.roomId || userId;

    try {
      if (type === "message" && message?.type === "text") {
        const text = message.text.trim();

        if (text === "/report" || text === "/สรุป") {
          const summary = await getMonthlySummary();
          await reply(replyToken, [{ type: "text", text: buildReportText(summary) }]);
          continue;
        }
        if (text === "/link" || text === "/dashboard") {
          await reply(replyToken, [{ type: "text", text: `Dashboard: ${process.env.NEXT_PUBLIC_APP_URL}` }]);
          continue;
        }
        if (text === "/help" || text === "/คู่มือ") {
          await reply(replyToken, [{ type: "text", text: `วิธีใช้งาน\n\nถ่ายรูปใบเสร็จ → Bot อ่านอัตโนมัติ\n\nพิมพ์รายการ เช่น:\n"ค่าน้ำมัน 450 ส่วนตัว"\n"Kerry 1200 with_layers"\n"วัสดุ 8500 s2000"\n\n/report → สรุปเดือนนี้\n/link → Dashboard` }]);
          continue;
        }

        // Check pending edit
        const userPendingKey = Array.from(pending.keys()).find(k => k.startsWith(`${userId}_`) && pending.get(k).awaitingEdit);
        if (userPendingKey) {
          const item = pending.get(userPendingKey);
          const amountMatch = text.match(/^(\d+(?:\.\d{1,2})?)$/);
          if (amountMatch) {
            item.amount = parseFloat(amountMatch[1]);
          } else if (!text.startsWith("/")) {
            item.vendor = text;
          }
          item.awaitingEdit = false;
          pending.set(userPendingKey, item);
          await reply(replyToken, [buildFlexMessage(item, userPendingKey) as any]);
          continue;
        }

        const parsed = parseTextExpense(text);
        if (parsed && parsed.amount > 0) {
          const tempId = `${userId}_${Date.now()}`;
          const name = await getProfile(userId);
          pending.set(tempId, { ...parsed, added_by: name, line_user_id: userId, replyTarget: groupTarget, awaitingEdit: false });
          setTimeout(() => pending.delete(tempId), 5 * 60 * 1000);
          await reply(replyToken, [buildFlexMessage({ ...parsed }, tempId) as any]);
        } else {
          await reply(replyToken, [{ type: "text", text: `ไม่เข้าใจรายการนี้ครับ\n\nตัวอย่าง: "ค่าน้ำมัน 450 ส่วนตัว"\nหรือถ่ายรูปใบเสร็จมาได้เลย\n\n/help ดูคู่มือ` }]);
        }
      }

      if (type === "message" && message?.type === "image") {
        await reply(replyToken, [{ type: "text", text: "กำลังอ่านใบเสร็จ..." }]);
        const img = await getImage(message.id);
        if (!img) { await push(groupTarget, [{ type: "text", text: "ดาวน์โหลดรูปไม่ได้ครับ ลองส่งใหม่" }]); continue; }

        const parsed = await ocrReceiptImage(img.base64, img.mediaType);
        if (!parsed || parsed.amount <= 0) {
          await push(groupTarget, [{ type: "text", text: "อ่านใบเสร็จไม่ชัดครับ ลองพิมพ์เองได้เลย" }]);
          continue;
        }

        const tempId = `${userId}_${Date.now()}`;
        const name = await getProfile(userId);
        pending.set(tempId, { ...parsed, added_by: name, line_user_id: userId, replyTarget: groupTarget, awaitingEdit: false });
        setTimeout(() => pending.delete(tempId), 5 * 60 * 1000);
        await push(groupTarget, [buildFlexMessage(parsed, tempId) as any]);
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
        const itemTarget = item.replyTarget || groupTarget;

        if (action === "cat") {
          item.category = params.get("cat") as CategoryId;
          item.awaitingEdit = false;
          // reset sub_category if not personal
          if (item.category !== "personal") item.sub_category = "";
          pending.set(tempId, item);
          await reply(replyToken, [buildFlexMessage(item, tempId) as any]);
        }

        if (action === "save") {
          await addExpense({
            date: item.date || new Date().toISOString().split("T")[0],
            vendor: item.vendor,
            amount: item.amount,
            category: item.category,
            sub_category: item.sub_category || "",
            note: item.note || "",
            added_by: item.added_by,
            line_user_id: item.line_user_id,
          });
          pending.delete(tempId);
          const cat = CATEGORIES[item.category as CategoryId];
          const subLine = item.sub_category ? ` (${item.sub_category})` : "";
          await push(itemTarget, [{ type: "text", text: `บันทึกแล้วครับ!\n\n${item.vendor}\n${Number(item.amount).toLocaleString("th-TH")} บาท\n${cat.label}${subLine}` }]);
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
