import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const ALL_CATS: Record<string, { label: string; color: string }> = {
  personal:    { label: "ส่วนตัว",      color: "#6366f1" },
  with_layers: { label: "WITH LAYERS",   color: "#f59e0b" },
  met:         { label: "MET Furniture", color: "#10b981" },
  steel_s2000: { label: "S-2000",        color: "#ef4444" },
  south_steel: { label: "เหล็กใต้",      color: "#f97316" },
  other:       { label: "อื่นๆ",         color: "#8b5cf6" },
};

const DEFAULT_CONFIG = {
  name: "กลุ่มของฉัน",
  categories: ["personal", "other"],
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await context.params;

  const { data } = await supabase
    .from("group_config")
    .select("*")
    .eq("group_id", groupId)
    .single();

  const config = data || { ...DEFAULT_CONFIG, group_id: groupId };
  const cats = (config.categories as string[]).map(id => ({
    id,
    ...(ALL_CATS[id] || { label: id, color: "#8b5cf6" }),
  }));

  return NextResponse.json({ ...config, cats });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await context.params;
  const body = await req.json();

  const { error } = await supabase
    .from("group_config")
    .upsert({ group_id: groupId, ...body });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}