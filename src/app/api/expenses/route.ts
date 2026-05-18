import { NextRequest, NextResponse } from "next/server";
import { getExpenses, getMonthlySummary, addExpense, updateExpense } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "list";
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const category = searchParams.get("category") || undefined;

  try {
    if (type === "summary") return NextResponse.json(await getMonthlySummary(month));
    return NextResponse.json(await getExpenses({ month, category }));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  await addExpense({
    vendor: b.vendor, amount: parseFloat(b.amount),
    category: b.category, sub_category: b.sub_category || "",
    note: b.note || "", added_by: b.added_by || "Web",
    line_user_id: "web", date: b.date || new Date().toISOString().split("T")[0],
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const b = await req.json();
  const { id, ...updates } = b;
  await updateExpense(id, updates);
  return NextResponse.json({ ok: true });
}
