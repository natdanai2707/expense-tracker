import { NextRequest, NextResponse } from "next/server";
import {
  getExpenses, getMonthlySummary, addExpense, updateExpense, deleteExpense,
} from "@/lib/supabase";
import { recentMonths, currentMonth } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "list";
  const month = searchParams.get("month") || currentMonth();
  const category = searchParams.get("category") || undefined;
  const group_id = searchParams.get("group_id") || undefined;
  const months = Math.min(24, Math.max(1, parseInt(searchParams.get("months") || "6")));

  try {
    if (type === "summary") return NextResponse.json(await getMonthlySummary(month, group_id));

    if (type === "monthly_trend") {
      const results = [];
      for (const m of recentMonths(month, months)) {
        const summary = await getMonthlySummary(m, group_id);
        const { month: _m, ...rest } = summary;
        results.push({ month: m, ...rest });
      }
      return NextResponse.json(results);
    }

    return NextResponse.json(await getExpenses({ month, category, group_id }));
  } catch (err) {
    console.error("GET /api/expenses failed:", err);
    return NextResponse.json({ error: (err as Error).message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const amount = parseFloat(b.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }
    const row = await addExpense({
      vendor: b.vendor || (b.type === "income" ? (b.income_category || "รายรับ") : "ไม่ระบุ"),
      amount,
      category: b.category || "other",
      sub_category: b.sub_category || "",
      note: b.note || "",
      added_by: b.added_by || "Web",
      line_user_id: b.line_user_id || "web",
      date: b.date || new Date().toISOString().split("T")[0],
      group_id: b.group_id || "default",
      type: b.type || "expense",
      income_category: b.income_category || "",
      receipt_url: b.receipt_url || null,
    });
    return NextResponse.json({ ok: true, expense: row });
  } catch (err) {
    console.error("POST /api/expenses failed:", err);
    return NextResponse.json({ error: (err as Error).message || "Failed to save" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    if (updates.amount !== undefined) {
      const amount = parseFloat(updates.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
      }
      updates.amount = amount;
    }
    const row = await updateExpense(id, updates);
    return NextResponse.json({ ok: true, expense: row });
  } catch (err) {
    console.error("PATCH /api/expenses failed:", err);
    return NextResponse.json({ error: (err as Error).message || "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await deleteExpense(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/expenses failed:", err);
    return NextResponse.json({ error: (err as Error).message || "Failed to delete" }, { status: 500 });
  }
}
