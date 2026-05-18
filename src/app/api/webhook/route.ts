import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { addExpense, getMonthlySummary, CATEGORIES, type CategoryId } from "@/lib/supabase";
import { parseTextExpense, ocrReceiptImage, buildConfirmFlexMessage, buildReportText } from "@/lib/parser";

// In-memory pending store (TTL 5 min)
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

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("x-line-signature") || "";
  if (!verify(rawBody, sig)) return NextResponse.json({ error: "Invalid signature" }, { status: 403 });

  const { events = [] } = JSON.parse(rawBody);

  for (const event of events) {
    const { replyToken, source, type, message, postback } = event;
    const userId = source?.userId || "unknown";

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
          await reply(replyToken, [{
            type: "text",
            text: `📱 วิธีใช้งาน\n\n📸 ถ่ายรูปใบเสร็จ → Bot อ่านอัตโนมัติ\n\n✍️ พิมพ์รายการ เช่น:\n• "ค่าน้ำมัน 450 ส่วนตัว"\n• "Kerry 1200 with_layers"\n• "วัสดุ 8500 เหล็ก"\n\n/report → สรุปเดือนนี้\n/link → เปิด Dashboard`,
          }]);
          continue;
        }

        const parsed = parseTextExpense(text);
        if (parsed && parsed.amount > 0) {
          const tempId = `${userId}_${Date.now()}`;
          const name = await getProfile(userId);
          pending.set(tempId, { ...parsed, added_by: name, line_user_id: userId });
          setTimeout(() => pending.delete(tempId), 5 * 60 * 1000);
          await reply(replyToken, [buildConfirmFlexMessage(parsed, tempId) as any]);
        } else {
          await reply(replyToken, [{ type: "text", text: `ไม่เข้าใจรายการนี้ครับ 🤔\n\nตัวอย่าง: "ค่าน้ำมัน 450 ส่วนตัว"\nหรือถ่ายรูปใบเสร็จมาได้เลย\n\n/help ดูคู่มือ` }]);
        }
      }

      // ── Image message ──
      if (type === "message" && message?.type === "image") {
        // groupId หรือ roomId ถ้ามี ไม่งั้น fallback userId
        const replyTarget = source?.groupId || source?.roomId || userId;

        await reply(replyToken, [{ type: "text", text: "⏳ กำลังอ่านใบเสร็จ..." }]);

        const img = await getImage(message.id);
        if (!img) { await push(replyTarget, [{ type: "text", text: "ดาวน์โหลดรูปไม่ได้ครับ ลองส่งใหม่" }]); continue; }

        const parsed = await ocrReceiptImage(img.base64, img.mediaType);
        if (!parsed || parsed.amount <= 0) {
          await push(replyTarget, [{ type: "text", text: "อ่านใบเสร็จไม่ชัดครับ 😅\nลองพิมพ์เองได้เลย เช่น 'ค่าไฟ 572 ส่วนตัว'" }]);
          continue;
        }

        const tempId = `${userId}_${Date.now()}`;
        const name = await getProfile(userId);
        pending.set(tempId, { ...parsed, added_by: name, line_user_id: userId });
        setTimeout(() => pending.delete(tempId), 5 * 60 * 1000);
        await push(replyTarget, [buildConfirmFlexMessage(parsed, tempId) as any]);
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

        if (action === "cat") {
          const newCat = params.get("cat") as CategoryId;
          pending.set(tempId, { ...item, category: newCat });
          const cat = CATEGORIES[newCat];
          await reply(replyToken, [{ type: "text", text: `เปลี่ยนหมวดเป็น ${cat.emoji} ${cat.label} แล้วครับ\nกด ✅ บันทึก เพื่อยืนยัน` }]);
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
          await reply(replyToken, [{
            type: "text",
            text: `✅ บันทึกแล้วครับ!\n\n🏪 ${exp.vendor}\n💰 ${exp.amount.toLocaleString("th-TH")} บาท\n${cat.emoji} ${cat.label}`,
          }]);
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
