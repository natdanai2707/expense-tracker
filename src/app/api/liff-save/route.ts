import { NextRequest, NextResponse } from "next/server";
import { addExpense, updateExpense } from "@/lib/supabase";

async function pushMessage(to: string, text: string) {
  if (!to || to === "liff" || to === "unknown") return;
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
  });
}

export async function POST(req: NextRequest) {
  const b = await req.json();

  if (b.existingId) {
    await updateExpense(b.existingId, {
      vendor: b.vendor,
      amount: parseFloat(b.amount),
      category: b.category,
      sub_category: b.sub_category || "",
      note: b.note || "",
      date: b.date,
      type: b.type || "expense",
      income_category: b.income_category || "",
    });

    // Push confirmation
    const target = b.group_id || b.line_user_id;
    await pushMessage(target, `✅ แก้ไขแล้วครับ!\n\n${b.vendor}\n${parseFloat(b.amount).toLocaleString("th-TH")} บาท`);
  } else {
    await addExpense({
      vendor: b.vendor,
      amount: parseFloat(b.amount),
      category: b.category,
      sub_category: b.sub_category || "",
      note: b.note || "",
      added_by: b.added_by || "LINE",
      line_user_id: b.line_user_id || "liff",
      date: b.date || new Date().toISOString().split("T")[0],
      group_id: b.group_id || "default",
      type: b.type || "expense",
      income_category: b.income_category || "",
    });

    // Push confirmation
    const target = b.group_id || b.line_user_id;
    await pushMessage(target, `✅ บันทึกแล้วครับ!\n\n${b.vendor}\n${parseFloat(b.amount).toLocaleString("th-TH")} บาท`);
  }

  return NextResponse.json({ ok: true });
}