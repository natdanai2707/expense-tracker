// ─────────────────────────────────────────────────────────────
// LINE Messaging API helpers with real error surfacing.
// Every call logs non-2xx responses instead of swallowing them.
// ─────────────────────────────────────────────────────────────

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const BASE = "https://api.line.me/v2/bot";
const DATA_BASE = "https://api-data.line.me/v2/bot";

function authHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${TOKEN}` };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function callLine(path: string, body: unknown): Promise<boolean> {
  if (!TOKEN) {
    console.error("LINE token missing; skipping", path);
    return false;
  }
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`LINE ${path} failed ${res.status}: ${detail}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`LINE ${path} threw:`, e);
    return false;
  }
}

export type LineMessage = { type: string; [k: string]: unknown };

export function reply(replyToken: string, messages: LineMessage[]): Promise<boolean> {
  return callLine("/message/reply", { replyToken, messages });
}

/** Push messages. Returns false (without throwing) for invalid targets. */
export function push(to: string, messages: LineMessage[]): Promise<boolean> {
  if (!to || to === "liff" || to === "unknown" || to === "web" || to === "default") {
    console.warn("push skipped for non-pushable target:", to);
    return Promise.resolve(false);
  }
  return callLine("/message/push", { to, messages });
}

export function pushText(to: string, text: string): Promise<boolean> {
  return push(to, [{ type: "text", text }]);
}

export async function getProfileName(userId: string): Promise<string> {
  if (!TOKEN || !userId || userId === "unknown") return "Unknown";
  try {
    const res = await fetch(`${BASE}/profile/${userId}`, { headers: authHeaders(false) });
    if (!res.ok) return "Unknown";
    const data = await res.json();
    return data.displayName || "Unknown";
  } catch {
    return "Unknown";
  }
}

export async function getImageContent(msgId: string): Promise<{ base64: string; mediaType: string } | null> {
  if (!TOKEN) return null;
  try {
    const res = await fetch(`${DATA_BASE}/message/${msgId}/content`, { headers: authHeaders(false) });
    if (!res.ok) {
      console.error("getImageContent failed", res.status);
      return null;
    }
    const buf = await res.arrayBuffer();
    return { base64: Buffer.from(buf).toString("base64"), mediaType: res.headers.get("content-type") || "image/jpeg" };
  } catch (e) {
    console.error("getImageContent threw:", e);
    return null;
  }
}
