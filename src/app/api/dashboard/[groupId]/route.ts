import { NextRequest, NextResponse } from "next/server";
import { getDashboard } from "@/lib/supabase";
import { currentMonth } from "@/lib/dates";

// One round-trip for the whole dashboard: list + summary + trend + daily + config.
export async function GET(req: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await context.params;
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || currentMonth();
    const trendMonths = Math.min(24, Math.max(1, parseInt(searchParams.get("trend") || "6")));
    const data = await getDashboard(month, groupId, trendMonths);
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/dashboard failed:", err);
    return NextResponse.json({ error: (err as Error).message || "Failed" }, { status: 500 });
  }
}
