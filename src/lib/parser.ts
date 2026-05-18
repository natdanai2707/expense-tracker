import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, type CategoryId } from "./supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ParsedExpense {
  vendor: string;
  amount: number;
  category: CategoryId;
  note: string;
  date?: string;
  confidence: "high" | "medium" | "low";
}

const CAT_KEYWORDS: Record<CategoryId, string[]> = {
  personal:    ["ส่วนตัว", "personal", "บ้าน", "อาหาร", "กิน", "น้ำมัน", "ค่าเดินทาง", "makro", "เซ็นทรัล"],
  with_layers: ["with layers", "withlayers", "layers", "wl", "ปากกา", "refill", "kerry", "j&t", "flash", "ไปรษณีย์", "แพ็ค"],
  met:         ["met", "เฟอร์นิเจอร์", "furniture", "สแตนเลส", "อลูมิเนียม", "กระจก"],
  steel:       ["เหล็ก", "s-2000", "s2000", "steel", "scg", "ปูน", "วัสดุก่อสร้าง", "โครงสร้าง"],
  other:       [],
};

export function parseTextExpense(text: string): ParsedExpense | null {
  const amountMatch = text.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:บาท|thb|฿)?/i);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (amount <= 0) return null;

  const lower = text.toLowerCase();
  let category: CategoryId = "other";

  for (const [cat, keywords] of Object.entries(CAT_KEYWORDS) as [CategoryId, string[]][]) {
    if (cat === "other") continue;
    if (keywords.some((kw) => lower.includes(kw))) { category = cat; break; }
  }

  const vendor = text
    .replace(/\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:บาท|thb|฿)?/gi, "")
    .replace(new RegExp(Object.values(CAT_KEYWORDS).flat().join("|"), "gi"), "")
    .replace(/\s+/g, " ").trim() || "ไม่ระบุ";

  return { vendor, amount, category, note: text, confidence: "medium" };
}

export async function ocrReceiptImage(
  imageBase64: string,
  mediaType: string
): Promise<ParsedExpense | null> {
  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as any, data: imageBase64 },
          },
          {
            type: "text",
            text: `วิเคราะห์ใบเสร็จในรูป ตอบเป็น JSON เท่านั้น:
{"vendor":"ชื่อร้าน","amount":0,"date":"YYYY-MM-DD หรือ null","note":"รายละเอียดสั้นๆ","category_hint":"personal/with_layers/met/steel/other"}`,
          },
        ],
      }],
    });

    const txt = res.content[0].type === "text" ? res.content[0].text : "";
    const match = txt.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const p = JSON.parse(match[0]);
    return {
      vendor:     p.vendor || "ไม่ระบุ",
      amount:     parseFloat(p.amount) || 0,
      date:       p.date || undefined,
      note:       p.note || "",
      category:   (p.category_hint as CategoryId) || "other",
      confidence: p.vendor && p.amount > 0 ? "high" : "low",
    };
  } catch (e) {
    console.error("OCR error:", e);
    return null;
  }
}

export function buildConfirmFlexMessage(expense: ParsedExpense, tempId: string) {
  const cat = CATEGORIES[expense.category];
  return {
    type: "flex",
    altText: `บันทึก ${expense.vendor} ${expense.amount} บาท?`,
    contents: {
      type: "bubble",
      body: {
        type: "box", layout: "vertical",
        contents: [
          { type: "text", text: "📋 ตรวจสอบรายการ", weight: "bold", size: "md" },
          { type: "separator", margin: "md" },
          {
            type: "box", layout: "vertical", margin: "md", spacing: "sm",
            contents: [
              row("🏪 ร้านค้า", expense.vendor),
              row("💰 จำนวน", `${expense.amount.toLocaleString("th-TH")} บาท`),
              row(`${cat.emoji} หมวด`, cat.label),
              ...(expense.note ? [row("📝 หมายเหตุ", expense.note.slice(0, 60))] : []),
            ],
          },
          { type: "separator", margin: "md" },
          { type: "text", text: "เปลี่ยนหมวดหมู่ได้:", size: "xs", color: "#888888", margin: "md" },
          {
            type: "box", layout: "horizontal", margin: "sm", spacing: "xs",
            contents: Object.entries(CATEGORIES).map(([id, info]) => ({
              type: "button",
              action: { type: "postback", label: info.emoji, data: `action=cat&id=${tempId}&cat=${id}`, displayText: `เปลี่ยนเป็น ${info.label}` },
              style: id === expense.category ? "primary" : "secondary",
              height: "sm", flex: 1,
            })),
          },
        ],
      },
      footer: {
        type: "box", layout: "vertical", spacing: "sm",
        contents: [
          {
            type: "button",
            action: { type: "postback", label: "✅ บันทึก", data: `action=save&id=${tempId}`, displayText: "บันทึกรายการนี้" },
            style: "primary", color: "#6366f1",
          },
          {
            type: "button",
            action: { type: "postback", label: "❌ ยกเลิก", data: `action=cancel&id=${tempId}`, displayText: "ยกเลิก" },
            style: "secondary",
          },
        ],
      },
    },
  };
}

function row(label: string, value: string) {
  return {
    type: "box", layout: "horizontal",
    contents: [
      { type: "text", text: label, size: "sm", color: "#666666", flex: 3 },
      { type: "text", text: value, size: "sm", color: "#111111", flex: 5, weight: "bold", wrap: true },
    ],
  };
}

export function buildReportText(summary: any): string {
  const lines = [
    `📊 สรุปค่าใช้จ่าย`,
    `รวม: ${summary.total.toLocaleString("th-TH")} บาท (${summary.count} รายการ)\n`,
  ];
  for (const [, d] of Object.entries(summary.byCategory) as any) {
    if (d.count > 0) lines.push(`${d.emoji} ${d.label}: ${d.total.toLocaleString("th-TH")} บาท`);
  }
  lines.push(`\n🔗 ${process.env.NEXT_PUBLIC_APP_URL}`);
  return lines.join("\n");
}
