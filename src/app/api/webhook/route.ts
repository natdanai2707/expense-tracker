import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { addExpense, getMonthlySummary, ensureGroupConfig, getGroupCategories } from "@/lib/supabase";
import { parseTextExpense, ocrReceiptImage, buildFlexMessage, buildReportText } from "@/lib/parser";
import { reply, push, pushText, getProfileName, getImageContent } from "@/lib/line";
import { uploadReceipt } from "@/lib/storage";
import { setPending, getPending, deletePending, findAwaitingEdit, type PendingItem } from "@/lib/pending";
import type { CategoryId } from "@/lib/constants";
import { todayISO } from "@/lib/dates";
import { baht } from "@/lib/format";

function verify(body: string, sig: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return false;
  const hmac = crypto.createHmac("SHA256", secret).update(body).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(sig));
  } catch {
    return false;
  }
}

interface LineEvent {
  replyToken?: string;
  source?: { userId?: string; groupId?: string; roomId?: string };
  type: string;
  message?: { type: string; text?: string; id?: string };
  postback?: { data: string };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("x-line-signature") || "";
  if (!verify(rawBody, sig)) return NextResponse.json({ error: "Invalid signature" }, { status: 403 });

  let events: LineEvent[] = [];
  try {
    events = JSON.parse(rawBody).events || [];
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  for (const event of events) {
    const { replyToken, source, type, message, postback } = event;
    const userId = source?.userId || "unknown";
    const groupId = source?.groupId || source?.roomId || userId;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

    try {
      if (type === "message" && message?.type === "text") {
        const text = (message.text || "").trim();

        if (text === "/report" || text === "/สรุป") {
          const summary = await getMonthlySummary(undefined, groupId);
          if (replyToken) await reply(replyToken, [{ type: "text", text: buildReportText(summary) }]);
          continue;
        }
        if (text === "/link" || text === "/dashboard") {
          if (replyToken) await reply(replyToken, [{ type: "text", text: `Dashboard: ${appUrl}/g/${groupId}` }]);
          continue;
        }
        if (text === "/help" || text === "/คู่มือ") {
          if (replyToken) await reply(replyToken, [{ type: "text", text: `วิธีใช้งาน\n\nถ่ายรูปใบเสร็จ → Bot อ่านอัตโนมัติ\n\nพิมพ์รายการ เช่น:\n"ค่าน้ำมัน 450"\n"รับ 50000 เงินเดือน"\n\n/report → สรุปเดือนนี้\n/link → Dashboard` }]);
          continue;
        }

        // Handle a pending "edit amount / vendor" reply
        const awaiting = await findAwaitingEdit(userId);
        if (awaiting) {
          const { id, item } = awaiting;
          const amountMatch = text.match(/^(\d+(?:\.\d{1,2})?)$/);
          if (amountMatch) item.amount = parseFloat(amountMatch[1]);
          else if (!text.startsWith("/")) item.vendor = text;
          item.awaitingEdit = false;
          await setPending(id, item);
          const groupCats = await getGroupCategories(item.group_id || groupId);
          if (replyToken) await reply(replyToken, [buildFlexMessage(item, id, groupCats) as never]);
          continue;
        }

        const parsed = parseTextExpense(text);
        if (parsed && parsed.amount > 0) {
          await ensureGroupConfig(groupId);
          const groupCats = await getGroupCategories(groupId);
          if (parsed.type === "expense" && !groupCats.includes(parsed.category)) {
            parsed.category = groupCats[0] as CategoryId;
          }
          const tempId = `${userId}_${Date.now()}`;
          const name = await getProfileName(userId);
          const item: PendingItem = { ...parsed, added_by: name, line_user_id: userId, group_id: groupId, replyTarget: groupId, awaitingEdit: false };
          await setPending(tempId, item);
          if (replyToken) await reply(replyToken, [buildFlexMessage(item, tempId, groupCats) as never]);
        } else if (replyToken) {
          await reply(replyToken, [{ type: "text", text: `ไม่เข้าใจรายการนี้ครับ\n\nตัวอย่าง: "ค่าน้ำมัน 450"\nหรือถ่ายรูปใบเสร็จมาได้เลย\n\n/help ดูคู่มือ` }]);
        }
      }

      if (type === "message" && message?.type === "image" && message.id) {
        if (replyToken) await reply(replyToken, [{ type: "text", text: "กำลังอ่านใบเสร็จ..." }]);
        const img = await getImageContent(message.id);
        if (!img) { await pushText(groupId, "ดาวน์โหลดรูปไม่ได้ครับ ลองส่งใหม่"); continue; }

        const parsed = await ocrReceiptImage(img.base64, img.mediaType);
        if (!parsed || parsed.amount <= 0) {
          await pushText(groupId, "อ่านใบเสร็จไม่ชัดครับ ลองพิมพ์เองได้เลย");
          continue;
        }

        await ensureGroupConfig(groupId);
        const groupCats = await getGroupCategories(groupId);
        if (parsed.type === "expense" && !groupCats.includes(parsed.category)) {
          parsed.category = groupCats[0] as CategoryId;
        }

        // Store the original receipt image (best effort — never blocks the save).
        const receiptUrl = await uploadReceipt(img.base64, img.mediaType, groupId);

        const tempId = `${userId}_${Date.now()}`;
        const name = await getProfileName(userId);
        const item: PendingItem = { ...parsed, added_by: name, line_user_id: userId, group_id: groupId, replyTarget: groupId, awaitingEdit: false, receipt_url: receiptUrl };
        await setPending(tempId, item);
        await push(groupId, [buildFlexMessage(item, tempId, groupCats) as never]);
      }

      if (type === "postback" && postback) {
        const params = new URLSearchParams(postback.data);
        const action = params.get("action");
        const tempId = params.get("id");

        const item = tempId ? await getPending(tempId) : null;
        if (!tempId || !item) {
          if (replyToken) await reply(replyToken, [{ type: "text", text: "รายการหมดอายุแล้วครับ กรุณาส่งใหม่" }]);
          continue;
        }

        const itemTarget = item.replyTarget || groupId;
        const groupCats = await getGroupCategories(item.group_id || groupId);

        if (action === "cat") {
          item.category = (params.get("cat") || item.category) as CategoryId;
          item.awaitingEdit = false;
          if (item.category !== "personal") item.sub_category = "";
          await setPending(tempId, item);
          if (replyToken) await reply(replyToken, [buildFlexMessage(item, tempId, groupCats) as never]);
        } else if (action === "edit_amount") {
          item.awaitingEdit = true;
          await setPending(tempId, item);
          if (replyToken) await reply(replyToken, [{ type: "text", text: "พิมพ์จำนวนเงินใหม่ได้เลยครับ เช่น 450" }]);
        } else if (action === "edit_vendor") {
          item.awaitingEdit = true;
          await setPending(tempId, item);
          if (replyToken) await reply(replyToken, [{ type: "text", text: "พิมพ์ชื่อร้านค้าหรือรายการใหม่ได้เลยครับ" }]);
        } else if (action === "save") {
          await addExpense({
            date: item.date || todayISO(),
            vendor: item.vendor, amount: item.amount,
            category: item.category, sub_category: item.sub_category || "",
            note: item.note || "", added_by: item.added_by,
            line_user_id: item.line_user_id, group_id: item.group_id || groupId,
            type: item.type || "expense",
            income_category: item.income_category || "",
            receipt_url: item.receipt_url || null,
          });
          await deletePending(tempId);
          const isIncome = item.type === "income";
          const label = isIncome ? (item.income_category || "รายรับ") : item.category;
          const subLine = item.sub_category ? ` (${item.sub_category})` : "";
          await pushText(itemTarget, `บันทึกแล้วครับ!\n\n${item.vendor}\n${baht(item.amount)} บาท\n${label}${subLine}`);
        } else if (action === "cancel") {
          await deletePending(tempId);
          if (replyToken) await reply(replyToken, [{ type: "text", text: "ยกเลิกแล้วครับ" }]);
        }
      }
    } catch (err) {
      console.error("Webhook error:", err);
      if (replyToken) {
        try { await reply(replyToken, [{ type: "text", text: "เกิดข้อผิดพลาด กรุณาลองใหม่ครับ" }]); } catch { /* ignore */ }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
