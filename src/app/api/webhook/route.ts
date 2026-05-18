import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { addExpense, getMonthlySummary, CATEGORIES, type CategoryId } from "@/lib/supabase";
import { parseTextExpense, ocrReceiptImage, buildConfirmFlexMessage, buildReportText } from "@/lib/parser";

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
  const data = await res.json();
  return data.displayName || "Unknown";
}

async function getImage(msgId: string): Promise<{ base64: string; mediaType: string } | null> {
  const res = await fetch(`https://api-data.line.me/v2/bot/message/${msgId}/content`, {
    headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
  });
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  return { base64: Buffer.from(buf).toString("base64"), mediaType: res.headers.get("content-type") || "image/jpeg" };
}

// Category short labels for buttons (no emoji, max 12 chars)
const CAT_SHORT: Record<string, string> = {
  personal:    "ส่วนตัว",
  with_layers: "W.LAYERS",
  met:         "MET",
  steel:       "เหล็กใต้",
  other:       "อื่นๆ",
};

function buildFlexMessage(item: any, tempId: string) {
  const cat = CATEGORIES[item.category as CategoryId] || CATEGORIES.other;
  return {
    type: "flex",
    altText: `บันทึก ${item.vendor} ${item.amount} บาท?`,
    contents: {
      type: "bubble",
      body: {
        type: "box", layout: "vertical",
        contents: [
          { type: "text", text: "📋 ตรวจสอบรายการ", weight: "bold", size: "md" },
          { type: "separator", margin: "md" },
          {
            type: "box", layout: "vertical", margin: "md", spacing: "sm",
            contents: [
              { type: "box", layout: "horizontal", contents: [
                { type: "text", text: "ร้านค้า", size: "sm", color: "#666666", flex: 3 },
                { type: "text", text: item.vendor, size: "sm", color: "#111111", flex: 5, weight: "bold", wrap: true },
              ]},
              { type: "box", layout: "horizontal", contents: [
                { type: "text", text: "จำนวน", size: "sm", color: "#666666", flex: 3 },
                { type: "text", text: `${Number(item.amount).toLocaleString("th-TH")} บาท`, size: "sm", color: "#111111", flex: 5, weight: "bold" },
              ]},
              { type: "box", layout: "horizontal", contents: [
                { type: "text", text: "หมวด", size: "sm", color: "#666666", flex: 3 },
                { type: "text", text: `${cat.emoji} ${cat.label}`, size: "sm", color: "#111111", flex: 5, weight: "bold" },
              ]},
            ],
          },
          { type: "separator", margin: "md" },
          { type: "text", text: "แก้ไขได้โดยพิมพ์ตอบกลับ:", size: "xs", color: "#888888", margin: "md" },
          { type: "text", text: "• ตัวเลข เช่น 450\n• ชื่อร้าน เช่น Starbucks\n• หมวด กดปุ่มด้านล่าง", size: "xs", color: "#aaaaaa", wrap: true },
        ],
      },
      footer: {
        type: "box", layout: "vertical", spacing: "sm",
        contents: [
          {
            type: "box", layout: "horizontal", spacing: "xs",
            contents: Object.entries(CAT_SHORT).map(([id, label]) => ({
              type: "button",
              action: { type: "postback", label, data: `action=cat&id=${tempId}&cat=${id}`, displayText: `เปลี่ยนหมวดเป็น ${label}` },
              style: id === item.category ? "primary" : "secondary",
              height: "sm", flex: 1,
            })),
          },
          {
            type: "button",
            action: { type: "postback", label: "บันทึก", data: `action=save&id=${tempId}`, displayText: "บันทึกรายการนี้" },
            style: "primary", color: "#6366f1", margin: "sm",
          },
          {
            type: "button",
            action: { type: "postback", label: "ยกเลิก", data: `action=cancel&id=${tempId}`, displayText: "ยกเลิก" },
            style: "secondary",
          },
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
    const groupTarget = source?.groupId || source?.roomId || userId;

    try {
      // ── Text message ──
      if (type === "message" && message?.type === "text") {
        const text = message.text.trim();

        if (text === "/report" || text === "/สรุป") {
          const summary = await getMonthlySummary();
          await reply(replyToken, [{ type: "text", text: buildReportText(summary) }]);
          continue;
        }

        if (text === "/link" || text === "/dashboard") {
          await reply(replyToken, [{ type: "text", text: `🔗 Dashboard: ${process.env.NEXT_PUBLIC_APP_URL}` }]);
          continue;
        }

        if (text === "/help" || text === "/คู่มือ") {
          await reply(replyToken, [{ type: "text", text: `📱 วิธีใช้งาน\n\n📸 ถ่ายรูปใบเสร็จ → Bot อ่านอัตโนมัติ\n\n✍️ พิมพ์รายการ เช่น:\n• "ค่าน้ำมัน 450 ส่วนตัว"\n• "Kerry 1200 with_layers"\n• "วัสดุ 8500 เหล็ก"\n\n/report → สรุปเดือนนี้\n/link → เปิด Dashboard` }]);
          continue;
        }

        // ── ตรวจว่ามี pending รอแก้ไขไหม ──
        const userPendingKey = [...pending.keys()].find(k => k.startsWith(`${userId}_`) && pending.get(k).awaitingEdit);
        if (userPendingKey) {
          const item = pending.get(userPendingKey);
          const amountMatch = text.match(/^(\d+(?:\.\d{1,2})?)$/);

          if (amountMatch) {
            // แก้ตัวเลข
            item.amount = parseFloat(amountMatch[1]);
            item.awaitingEdit = false;
            pending.set(userPendingKey, item);
            await reply(replyToken, [buildFlexMessage(item, userPendingKey) as any]);
          } else if (text.length <= 60 && !text.startsWith("/")) {
            // แก้ vendor
            item.vendor = text;
            item.awaitingEdit = false;
            pending.set(userPendingKey, item);
            await reply(replyToken, [buildFlexMessage(item, userPendingKey) as any]);
          }
          continue;
        }

        const parsed = parseTextExpense(text);
        if (parsed && parsed.amount > 0) {
          const tempId = `${userId}_${Date.now()}`;
          const name = await getProfile(userId);
          pending.set(tempId, { ...parsed, added_by: name, line_user_id: userId, replyTarget: groupTarget, awaitingEdit: false });
          setTimeout(() => pending.delete(tempId), 5 * 60 * 1000);
          await reply(replyToken, [buildFlexMessage({ ...parsed, added_by: name }, tempId) as any]);
        } else {
          await reply(replyToken, [{ type: "text", text: `ไม่เข้าใจรายการนี้ครับ 🤔\n\nตัวอย่าง: "ค่าน้ำมัน 450 ส่วนตัว"\nหรือถ่ายรูปใบเสร็จมาได้เลย\n\n/help ดูคู่มือ` }]);
        }
      }

      // ── Image message ──
      if (type === "message" && message?.type === "image") {
        await reply(replyToken, [{ type: "text", text: "⏳ กำลังอ่านใบเสร็จ..." }]);

        const img = await getImage(message.id);
        if (!img) { await push(groupTarget, [{ type: "text", text: "ดาวน์โหลดรูปไม่ได้ครับ ลองส่งใหม่" }]); continue; }

        const parsed = await ocrReceiptImage(img.base64, img.mediaType);
        if (!parsed || parsed.amount <= 0) {
          await push(groupTarget, [{ type: "text", text: "อ่านใบเสร็จไม่ชัดครับ 😅\nลองพิมพ์เองได้เลย เช่น 'ค่าไฟ 572 ส่วนตัว'" }]);
          continue;
        }

        const tempId = `${userId}_${Date.now()}`;
        const name = await getProfile(userId);
        pending.set(tempId, { ...parsed, added_by: name, line_user_id: userId, replyTarget: groupTarget, awaitingEdit: false });
        setTimeout(() => pending.delete(tempId), 5 * 60 * 1000);
        await push(groupTarget, [buildFlexMessage({ ...parsed, added_by: name }, tempId) as any]);
      }

      // ── Postback ──
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
          const newCat = params.get("cat") as CategoryId;
          item.category = newCat;
          item.awaitingEdit = false;
          pending.set(tempId, item);
          await reply(replyToken, [buildFlexMessage(item, tempId) as any]);
        }

        if (action === "edit_amount") {
          item.awaitingEdit = true;
          pending.set(tempId, item);
          await reply(replyToken, [{ type: "text", text: "พิมพ์จำนวนเงินใหม่ได้เลยครับ เช่น 450" }]);
        }

        if (action === "edit_vendor") {
          item.awaitingEdit = true;
          pending.set(tempId, item);
          await reply(replyToken, [{ type: "text", text: "พิมพ์ชื่อร้านค้าใหม่ได้เลยครับ" }]);
        }

        if (action === "save") {
          const exp = pending.get(tempId);
          await addExpense({
            date: exp.date || new Date().toISOString().split("T")[0],
            vendor: exp.vendor,
            amount: exp.amount,
            category: exp.category,
            note: exp.note || "",
            added_by: exp.added_by,
            line_user_id: exp.line_user_id,
          });
          pending.delete(tempId);
          const cat = CATEGORIES[exp.category as CategoryId];
          await push(itemTarget, [{ type: "text", text: `✅ บันทึกแล้วครับ!\n\n🏪 ${exp.vendor}\n💰 ${Number(exp.amount).toLocaleString("th-TH")} บาท\n${cat.emoji} ${cat.label}` }]);
        }

        if (action === "cancel") {
          pending.delete(tempId);
          await reply(replyToken, [{ type: "text", text: "ยกเลิกแล้วครับ 👍" }]);
        }
      }
    } catch (err) {
      console.error("Webhook error:", err);
      try { await reply(replyToken, [{ type: "text", text: "เกิดข้อผิดพลาด กรุณาลองใหม่ครับ" }]); } catch {}
    }
  }

  return NextResponse.json({ ok: true });
}
