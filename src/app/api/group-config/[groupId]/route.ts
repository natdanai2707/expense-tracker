import { NextRequest, NextResponse } from "next/server";
import { supabase, getGroupConfig } from "@/lib/supabase";

export async function GET(_req: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await context.params;
    return NextResponse.json(await getGroupConfig(groupId));
  } catch (err) {
    console.error("GET /api/group-config failed:", err);
    return NextResponse.json({ error: (err as Error).message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await context.params;
    const body = await req.json();
    const { error } = await supabase.from("group_config").upsert({ group_id: groupId, ...body });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/group-config failed:", err);
    return NextResponse.json({ error: (err as Error).message || "Failed" }, { status: 500 });
  }
}
