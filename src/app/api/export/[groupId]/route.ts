import { NextRequest, NextResponse } from "next/server";
import { getExpenses } from "@/lib/supabase";
import { categoryMeta } from "@/lib/constants";
import { currentMonth } from "@/lib/dates";

// CSV export for a group/month, for accounting. UTF-8 BOM so Excel reads Thai.
export async function GET(req: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await context.params;
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || currentMonth();

    const rows = await getExpenses({ month, group_id: groupId });

    const header = ["วันที่", "ประเภท", "ร้านค้า/รายการ", "หมวด", "หมวดย่อย", "จำนวน", "หมายเหตุ", "บันทึกโดย"];
    const csvRows = rows.map((e) => [
      e.date,
      e.type === "income" ? "รายรับ" : "รายจ่าย",
      e.vendor,
      e.type === "income" ? (e.income_category || "รายรับ") : categoryMeta(e.category).label,
      e.sub_category || "",
      String(e.amount),
      e.note || "",
      e.added_by || "",
    ]);

    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = "﻿" + [header, ...csvRows].map((r) => r.map(esc).join(",")).join("\r\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="expenses-${groupId.slice(0, 8)}-${month}.csv"`,
      },
    });
  } catch (err) {
    console.error("GET /api/export failed:", err);
    return NextResponse.json({ error: (err as Error).message || "Failed" }, { status: 500 });
  }
}
