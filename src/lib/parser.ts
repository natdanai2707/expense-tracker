import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, type CategoryId } from "./supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ParsedExpense {
  vendor: string;
  amount: number;
  category: CategoryId;
  sub_category: string;
  note: string;
  date?: string;
}

// Sub-category keywords for personal
const SUB_CAT_KEYWORDS: Record<string, string[]> = {
  "ค่าอาหาร":              ["ข้าว", "อาหาร", "นม", "ขนม", "7-11", "เซเว่น", "ผัก", "เนื้อ", "กล้วย", "น้ำ"],
  "อาหารนอกบ้าน/คาเฟ่":   ["กาแฟ", "คาเฟ่", "ร้านอาหาร", "ชาบู", "บุฟเฟ่", "momo", "sushi", "บาบีคิว", "away coffee", "away"],
  "ค่าที่พัก/สาธารณูปโภค": ["เช่าบ้าน", "ค่าเช่า", "ค่าไฟ", "ค่าน้ำ", "internet", "subscription", "coway", "ส่วนกลาง"],
  "ค่าเดินทาง":            ["น้ำมัน", "grab", "bts", "mrt", "ค่าส่ง", "จอดรถ", "taxi", "เติมรถ", "ชาร์จรถ", "เติมชาร์จ"],
  "ค่ารักษาพยาบาล":        ["หมอ", "ยา", "โรงพยาบาล", "clinic", "พิลาทิส", "หาหมอ", "bella vita"],
  "ช้อปปิ้ง":              ["shopee", "lazada", "รองเท้า", "เสื้อผ้า", "กระเป๋า", "ซื้อของ"],
  "สันทนาการ":             ["บอล", "ปีนผา", "โค้ช", "นวด", "หนัง", "mpass", "เตะบอล", "gym"],
  "ท่องเที่ยว":            ["ตั๋ว", "ที่พัก", "โรงแรม", "hotel", "ทริป", "เที่ยว"],
  "ของขวัญ":               ["ให้แม่", "ให้พ่อ", "ของขวัญ", "เลี้ยง", "gift"],
  "การออม/ลงทุน":          ["ออม", "kept", "โอน kept", "ลงทุน", "หุ้น", "กองทุน"],
};

const CAT_KEYWORDS: Record<CategoryId, string[]> = {
  personal:    ["ส่วนตัว", "personal"],
  with_layers: ["with layers", "withlayers", "wl", "layers", "kerry", "j&t", "flash", "ไปรษณีย์", "แพ็ค", "ปากกา", "refill"],
  met:         ["met", "เฟอร์นิเจอร์", "furniture", "สแตนเลส", "อลูมิเนียม", "กระจก"],
  steel_s2000: ["s-2000", "s2000", "เบิก s2000", "เบิก s-2000"],
  south_steel: ["เหล็กใต้", "south steel", "southsteel", "เบิกเหล็กใต้"],
  other:       [],
};

function detectSubCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const [sub, keywords] of Object.entries(SUB_CAT_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return sub;
  }
  return "อื่นๆ";
}

export function parseTextExpense(text: string): ParsedExpense | null {
  const amountMatch = text.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:บาท|thb|฿)?/i);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (amount <= 0) return null;

  const lower = text.toLowerCase();
  let category: CategoryId = "personal";

  for (const [cat, keywords] of Object.entries(CAT_KEYWORDS) as [CategoryId, string[]][]) {
    if (cat === "personal" || cat === "other") continue;
    if (keywords.some(kw => lower.includes(kw))) { category = cat; break; }
  }

  const sub_category = category === "personal" ? detectSubCategory(text) : "";

  const vendor = text
    .replace(/\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:บาท|thb|฿)?/gi, "")
    .replace(/ส่วนตัว|personal|with layers|withlayers|เหล็กใต้|s-2000|s2000/gi, "")
    .replace(/\s+/g, " ").trim() || "ไม่ระบุ";

  return { vendor, amount, category, sub_category, note: text };
}

export async function ocrReceiptImage(imageBase64: string, mediaType: string): Promise<ParsedExpense | null> {
  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType as any, data: imageBase64 } },
          { type: "text", text: `วิเคราะห์ใบเสร็จในรูป ตอบเป็น JSON เท่านั้น:
{
  "vendor": "ชื่อร้าน",
  "amount": 0,
  "date": "YYYY-MM-DD หรือ null",
  "note": "รายละเอียดสั้นๆ",
  "category": "personal/with_layers/met/steel_s2000/south_steel/other",
  "sub_category": "ค่าอาหาร/อาหารนอกบ้าน-คาเฟ่/ค่าที่พัก-สาธารณูปโภค/ค่าเดินทาง/ค่ารักษาพยาบาล/ช้อปปิ้ง/สันทนาการ/ท่องเที่ยว/ของขวัญ/การออม-ลงทุน/อื่นๆ (ใส่เฉพาะถ้า category=personal)"
}

หลักการจัดหมวด:
- personal = ค่าใช้จ่ายส่วนตัวทั่วไป
- with_layers = ค่าส่ง บรรจุภัณฑ์ ต้นทุน WITH LAYERS
- met = ต้นทุน MET Furniture วัสดุเฟอร์นิเจอร์
- steel_s2000 = ค่าใช้จ่ายที่จะเบิกบริษัท S-2000
- south_steel = ค่าใช้จ่ายที่จะเบิกบริษัทเหล็กใต้
- other = อื่นๆ` },
        ],
      }],
    });

    const txt = res.content[0].type === "text" ? res.content[0].text : "";
    const match = txt.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const p = JSON.parse(match[0]);
    return {
      vendor:       p.vendor || "ไม่ระบุ",
      amount:       parseFloat(p.amount) || 0,
      date:         p.date || undefined,
      note:         p.note || "",
      category:     (p.category as CategoryId) || "personal",
      sub_category: p.sub_category || "",
    };
  } catch (e) {
    console.error("OCR error:", e);
    return null;
  }
}

const CAT_SHORT: Record<string, string> = {
  personal:    "ส่วนตัว",
  with_layers: "WITH LAYERS",
  met:         "MET",
  steel_s2000: "S-2000",
  south_steel: "เหล็กใต้",
  other:       "อื่นๆ",
};

export function buildFlexMessage(item: any, tempId: string) {
  const cat = CATEGORIES[item.category as CategoryId] || CATEGORIES.other;
  const subLine = item.sub_category ? `${item.sub_category}` : "-";

  return {
    type: "flex",
    altText: `บันทึก ${item.vendor} ${item.amount} บาท?`,
    contents: {
      type: "bubble",
      body: {
        type: "box", layout: "vertical",
        contents: [
          { type: "text", text: "ตรวจสอบรายการ", weight: "bold", size: "md" },
          { type: "separator", margin: "md" },
          {
            type: "box", layout: "vertical", margin: "md", spacing: "sm",
            contents: [
              row("ร้านค้า", item.vendor),
              row("จำนวน", `${Number(item.amount).toLocaleString("th-TH")} บาท`),
              row("หมวด", cat.label),
              ...(item.sub_category ? [row("หมวดย่อย", subLine)] : []),
            ],
          },
          { type: "separator", margin: "md" },
          { type: "text", text: "แก้ไข: พิมพ์ตัวเลข = แก้จำนวน, พิมพ์ชื่อ = แก้ร้านค้า", size: "xs", color: "#888888", margin: "md", wrap: true },
        ],
      },
      footer: {
        type: "box", layout: "vertical", spacing: "xs",
        contents: [
          {
            type: "box", layout: "horizontal", spacing: "xs",
            contents: ["personal", "with_layers", "met"].map(id => ({
              type: "button",
              action: { type: "postback", label: CAT_SHORT[id], data: `action=cat&id=${tempId}&cat=${id}`, displayText: `เปลี่ยนหมวดเป็น ${CAT_SHORT[id]}` },
              style: id === item.category ? "primary" : "secondary",
              height: "sm", flex: 1,
            })),
          },
          {
            type: "box", layout: "horizontal", spacing: "xs",
            contents: ["steel_s2000", "south_steel", "other"].map(id => ({
              type: "button",
              action: { type: "postback", label: CAT_SHORT[id], data: `action=cat&id=${tempId}&cat=${id}`, displayText: `เปลี่ยนหมวดเป็น ${CAT_SHORT[id]}` },
              style: id === item.category ? "primary" : "secondary",
              height: "sm", flex: 1,
            })),
          },
          {
            type: "button",
            action: { type: "postback", label: "บันทึก", data: `action=save&id=${tempId}`, displayText: "บันทึกรายการนี้" },
            style: "primary", color: "#6366f1", margin: "sm",
          },
          {
            type: "button",
            action: { type: "postback", label: "ยกเลิก", data: `action=cancel&id=${tempId}`, displayText: "ยกเลิก" },
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
  const lines = [`สรุปค่าใช้จ่าย`, `รวม: ${summary.total.toLocaleString("th-TH")} บาท (${summary.count} รายการ)\n`];
  for (const [, d] of Object.entries(summary.byCategory) as any) {
    if (d.count > 0) {
      lines.push(`${d.label}: ${d.total.toLocaleString("th-TH")} บาท`);
      if (d.bySubCategory && Object.keys(d.bySubCategory).length > 0) {
        for (const [sub, amt] of Object.entries(d.bySubCategory) as any) {
          lines.push(`  - ${sub}: ${amt.toLocaleString("th-TH")} บาท`);
        }
      }
    }
  }
  lines.push(`\n${process.env.NEXT_PUBLIC_APP_URL}`);
  return lines.join("\n");
}
