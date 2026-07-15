import { NextRequest, NextResponse } from "next/server";
import { addExpense, updateExpense } from "@/lib/supabase";
import { pushText } from "@/lib/line";
import { deletePending } from "@/lib/pending";
import { todayISO } from "@/lib/dates";
import { baht } from "@/lib/format";

export async function POST(req: NextRequest) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }

  const amount = parseFloat(String(b.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "amount must be a positive number" }, { status: 400 });
  }

  const type = (b.type as string) === "income" ? "income" : "expense";
  const vendor = (b.vendor as string) || (type === "income" ? ((b.income_category as string) || "รายรับ") : "ไม่ระบุ");

  // 1) Persist first — surface any DB error to the client.
  try {
    if (b.existingId) {
      await updateExpense(String(b.existingId), {
        vendor,
        amount,
        category: (b.category as string) || "other",
        sub_category: (b.sub_category as string) || "",
        note: (b.note as string) || "",
        date: (b.date as string) || todayISO(),
        type,
        income_category: (b.income_category as string) || "",
        receipt_url: (b.receipt_url as string) || null,
      });
    } else {
      await addExpense({
        vendor,
        amount,
        category: (b.category as string) || "other",
        sub_category: (b.sub_category as string) || "",
        note: (b.note as string) || "",
        added_by: (b.added_by as string) || "LINE",
        line_user_id: (b.line_user_id as string) || "liff",
        date: (b.date as string) || todayISO(),
        group_id: (b.group_id as string) || "default",
        type,
        income_category: (b.income_category as string) || "",
        receipt_url: (b.receipt_url as string) || null,
      });
    }
  } catch (err) {
    console.error("liff-save persist failed:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message || "Save failed" }, { status: 500 });
  }

  // The row is saved; clear any pending confirmation for this temp id.
  const tempId = (b.id as string) || (b.tempId as string);
  if (tempId) { try { await deletePending(tempId); } catch { /* best effort */ } }

  // 2) Push a LINE confirmation. A push failure must NOT fail the save —
  //    report it separately so the client can note it.
  const target = (b.group_id as string) || (b.line_user_id as string) || "";
  const verb = b.existingId ? "แก้ไขแล้ว" : "บันทึกแล้ว";
  const pushed = await pushText(target, `✅ ${verb}ครับ!\n\n${vendor}\n${baht(amount)} บาท`);

  return NextResponse.json({ ok: true, pushed });
}
