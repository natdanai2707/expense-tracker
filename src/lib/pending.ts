// ─────────────────────────────────────────────────────────────
// Pending-confirmation store for the LINE bot.
//
// The old code kept pending items in a module-level Map. On Vercel
// each request can hit a different serverless instance, so a postback
// ("ยืนยัน" / change category) frequently landed on an instance whose
// Map was empty → "รายการหมดอายุแล้ว" even seconds later.
//
// This store persists pending items in Supabase (table `pending_actions`)
// so any instance can resolve them. If that table doesn't exist yet
// (migration not applied), it transparently falls back to the in-memory
// Map so behaviour never regresses below the old baseline.
// ─────────────────────────────────────────────────────────────

import { supabase } from "./supabase";

export interface PendingItem {
  vendor: string;
  amount: number;
  category: string;
  sub_category: string;
  note: string;
  date?: string;
  type: "income" | "expense";
  income_category: string;
  added_by: string;
  line_user_id: string;
  group_id: string;
  replyTarget: string;
  awaitingEdit: boolean;
  receipt_url?: string | null;
}

const TTL_MS = 15 * 60 * 1000; // 15 min
const memory = new Map<string, { item: PendingItem; expires: number }>();

/** Track whether the DB table is usable; flips to false on first "missing table" error. */
let dbAvailable = true;

function isMissingTable(err: unknown): boolean {
  const msg = (err as { message?: string; code?: string })?.message || "";
  const code = (err as { code?: string })?.code || "";
  return code === "42P01" || /relation .*pending_actions.* does not exist/i.test(msg) || /could not find the table/i.test(msg);
}

function memGet(id: string): PendingItem | null {
  const rec = memory.get(id);
  if (!rec) return null;
  if (rec.expires < nowMs()) { memory.delete(id); return null; }
  return rec.item;
}

// Date.now() is fine in the app runtime (only workflow scripts forbid it).
function nowMs(): number {
  return Date.now();
}

export async function setPending(id: string, item: PendingItem): Promise<void> {
  memory.set(id, { item, expires: nowMs() + TTL_MS });
  if (!dbAvailable) return;
  try {
    const { error } = await supabase.from("pending_actions").upsert({
      id,
      payload: item,
      expires_at: new Date(nowMs() + TTL_MS).toISOString(),
    });
    if (error) {
      if (isMissingTable(error)) { dbAvailable = false; return; }
      console.error("setPending db error:", error.message);
    }
  } catch (e) {
    if (isMissingTable(e)) dbAvailable = false;
    else console.error("setPending exception:", e);
  }
}

export async function getPending(id: string): Promise<PendingItem | null> {
  const mem = memGet(id);
  if (mem) return mem;
  if (!dbAvailable) return null;
  try {
    const { data, error } = await supabase.from("pending_actions").select("payload, expires_at").eq("id", id).maybeSingle();
    if (error) {
      if (isMissingTable(error)) { dbAvailable = false; }
      else console.error("getPending db error:", error.message);
      return null;
    }
    if (!data) return null;
    if (data.expires_at && new Date(data.expires_at).getTime() < nowMs()) {
      await deletePending(id);
      return null;
    }
    const item = data.payload as PendingItem;
    memory.set(id, { item, expires: nowMs() + TTL_MS });
    return item;
  } catch (e) {
    if (isMissingTable(e)) dbAvailable = false;
    else console.error("getPending exception:", e);
    return null;
  }
}

export async function deletePending(id: string): Promise<void> {
  memory.delete(id);
  if (!dbAvailable) return;
  try {
    const { error } = await supabase.from("pending_actions").delete().eq("id", id);
    if (error && isMissingTable(error)) dbAvailable = false;
  } catch (e) {
    if (isMissingTable(e)) dbAvailable = false;
  }
}

/**
 * Find the caller's currently-awaiting-edit pending item.
 * Checks memory first (fast path), then the DB for cross-instance cases.
 */
export async function findAwaitingEdit(lineUserId: string): Promise<{ id: string; item: PendingItem } | null> {
  for (const [id, rec] of memory) {
    if (rec.expires < nowMs()) { memory.delete(id); continue; }
    if (rec.item.line_user_id === lineUserId && rec.item.awaitingEdit) return { id, item: rec.item };
  }
  if (!dbAvailable) return null;
  try {
    const { data, error } = await supabase
      .from("pending_actions")
      .select("id, payload, expires_at")
      .gte("expires_at", new Date(nowMs()).toISOString());
    if (error) {
      if (isMissingTable(error)) dbAvailable = false;
      return null;
    }
    for (const row of data || []) {
      const item = row.payload as PendingItem;
      if (item.line_user_id === lineUserId && item.awaitingEdit) {
        memory.set(row.id, { item, expires: nowMs() + TTL_MS });
        return { id: row.id, item };
      }
    }
  } catch (e) {
    if (isMissingTable(e)) dbAvailable = false;
  }
  return null;
}
