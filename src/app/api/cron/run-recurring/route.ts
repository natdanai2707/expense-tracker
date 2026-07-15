import { NextRequest, NextResponse } from "next/server";
import { runDueRecurring } from "@/lib/recurring";

// Triggered by Vercel Cron (see vercel.json). Optionally protected by CRON_SECRET.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runDueRecurring();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("cron run-recurring failed:", err);
    return NextResponse.json({ error: (err as Error).message || "Failed" }, { status: 500 });
  }
}
