import { NextRequest, NextResponse } from "next/server";
import { listRecurring, createRecurring, deleteRecurring } from "@/lib/recurring";

export async function GET(_req: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await context.params;
    return NextResponse.json(await listRecurring(groupId));
  } catch (err) {
    console.error("GET /api/recurring failed:", err);
    return NextResponse.json({ error: (err as Error).message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await context.params;
    const b = await req.json();
    const amount = parseFloat(b.amount);
    if (!b.vendor && b.type !== "income") return NextResponse.json({ error: "vendor required" }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount invalid" }, { status: 400 });
    const rule = await createRecurring({
      group_id: groupId,
      day_of_month: Math.min(Math.max(1, parseInt(b.day_of_month) || 1), 28),
      type: b.type === "income" ? "income" : "expense",
      vendor: b.vendor || b.income_category || "รายรับ",
      amount,
      category: b.category || "other",
      sub_category: b.sub_category || "",
      income_category: b.income_category || "",
      note: b.note || "",
      active: b.active !== false,
    });
    return NextResponse.json({ ok: true, rule });
  } catch (err) {
    console.error("POST /api/recurring failed:", err);
    return NextResponse.json({ error: (err as Error).message || "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await deleteRecurring(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/recurring failed:", err);
    return NextResponse.json({ error: (err as Error).message || "Failed" }, { status: 500 });
  }
}
