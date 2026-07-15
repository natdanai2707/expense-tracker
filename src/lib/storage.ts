import { supabase } from "./supabase";

const BUCKET = "receipts";

/**
 * Upload a base64 receipt image to Supabase Storage and return its public URL.
 * Returns null on any failure (missing bucket, network, etc.) so the caller
 * can proceed without a receipt rather than failing the whole save.
 */
export async function uploadReceipt(base64: string, mediaType: string, groupId: string): Promise<string | null> {
  try {
    const ext = mediaType.includes("png") ? "png" : mediaType.includes("webp") ? "webp" : "jpg";
    const safeGroup = groupId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "default";
    const path = `${safeGroup}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
    const bytes = Buffer.from(base64, "base64");

    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: mediaType,
      upsert: false,
    });
    if (error) {
      console.error("uploadReceipt failed:", error.message);
      return null;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl || null;
  } catch (e) {
    console.error("uploadReceipt threw:", e);
    return null;
  }
}
