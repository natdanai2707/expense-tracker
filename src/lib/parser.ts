import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, INCOME_CATEGORIES, type CategoryId } from "./supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ParsedExpense {
  vendor: string;
  amount: number;
  category: CategoryId;
  sub_category: string;
  note: string;
  date?: string;
  type: "income" | "expense";
  income_category: string;
}

const SUB_CAT_KEYWORDS: Record<string, string[]> = {
  "ค่าอาหาร":              ["ข้าว","อาหาร","นม","ขนม","7-11","เซเว่น","ผัก","เนื้อ","น้ำ"],
  "อาหารนอกบ้าน/คาเฟ่":   ["กาแฟ","คาเฟ่","ร้านอาหาร","ชาบู","บุฟเฟ่","sushi","ซูชิ","away"],
  "ค่าที่พัก/สาธารณูปโภค": ["เช่าบ้าน","ค่าเช่า","ค่าไฟ","ค่าน้ำ","internet","subscription","ส่วนกลาง"],
  "ค่าเดินทาง":            ["น้ำมัน","grab","bts","mrt","จอดรถ","taxi","เติมรถ"],
  "ค่ารักษาพยาบาล":        ["หมอ","ยา","โรงพยาบาล","clinic"],
  "ช้อปปิ้ง":              ["shopee","lazada","รองเท้า","เสื้อผ้า","กระเป๋า"],
  "สันทนาการ":             ["บอล","ปีนผา","โค้ช","นวด","หนัง","gym"],
  "ท่องเที่ยว":            ["ตั๋ว","โรงแรม","hotel","ทริป","เที่ยว"],
  "ของขวัญ":               ["ของขวัญ","เลี้ยง","gift"],
  "การออม/ลงทุน":          ["ออม","kept","ลงทุน","หุ้น","กองทุน"],
};

const INCOME_KEYWORDS: Record<string, string[]> = {
  "เงินเดือน":              ["เงินเดือน","salary"],
  "รายรับจาก MET":         ["met","รายรับ met"],
  "รายรับจาก With Layers": ["with layers","withlayers","layers","wl"],
  "เงินปันผล":             ["ปันผล","dividend"],
  "ค่าเช่า":               ["รับค่าเช่า","rent income"],
  "เงินคืนบัตรเครดิต":     ["คืนบัตร","cashback","เงินคืน"],
  "รายรับจากอื่นๆ":        ["รายรับ","ได้รับ","โอนเข้า","รับเงิน"],
};

const INCOME_TRIGGER = ["รับ","ได้รับ","income","รายรับ","เงินเดือน","ปันผล","cashback","เงินคืน"];

const CAT_KEYWORDS: Record<CategoryId, string[]> = {
  personal:    ["ส่วนตัว","personal"],
  with_layers: ["with layers","withlayers","wl","layers","kerry","j&t","flash","ไปรษณีย์","แพ็ค","ปากกา","refill"],
  met:         ["met","เฟอร์นิเจอร์","furniture","สแตนเลส","อลูมิเนียม"],
  steel_s2000: ["s-2000","s2000","เบิก s2000"],
  south_steel: ["เหล็กใต้","south steel","southsteel"],
  other:       [],
};

const CAT_LABELS: Record<string, string> = {
  personal: "ส่วนตัว", with_layers: "WITH LAYERS", met: "MET",
  steel_s2000: "S-2000", south_steel: "เหล็กใต้", other: "อื่นๆ",
};

function detectSubCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const [sub, keywords] of Object.entries(SUB_CAT_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return sub;
  }
  return "อื่นๆ";
}

function detectIncomeCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(INCOME_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return cat;
  }
  return "รายรับจากอื่นๆ";
}

export function parseTextExpense(text: string): ParsedExpense | null {
  const amountMatch = text.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:บาท|thb|฿)?/i);
  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (amount <= 0) return null;

  const lower = text.toLowerCase();
  const isIncome = INCOME_TRIGGER.some(kw => lower.includes(kw));

  if (isIncome) {
    const income_category = detectIncomeCategory(text);
    return { vendor: income_category, amount, category: "other", sub_category: "", note: text, type: "income", income_category };
  }

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

  return { vendor, amount, category, sub_category, note: text, type: "expense", income_category: "" };
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
{"vendor":"ชื่อร้าน","amount":0,"date":"YYYY-MM-DD หรือ null","note":"รายละเอียดสั้นๆ","type":"expense","category":"personal/with_layers/met/steel_s2000/south_steel/other","sub_category":"หมวดย่อย ถ้า personal","income_category":""}` },
        ],
      }],
    });

    const txt = res.content[0].type === "text" ? res.content[0].text : "";
    const match = txt.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const p = JSON.parse(match[0]);
    return {
      vendor: p.vendor || "ไม่ระบุ",
      amount: parseFloat(p.amount) || 0,
      date: p.date || undefined,
      note: p.note || "",
      type: p.type || "expense",
      category: (p.category as CategoryId) || "personal",
      sub_category: p.sub_category || "",
      income_category: p.income_category || "",
    };
  } catch (e) {
    console.error("OCR error:", e);
    return null;
  }
}

export function buildFlexMessage(item: any, tempId: string, groupCats: string[]) {
  const isIncome = item.type === "income";
  const label = isIncome ? (item.income_category || "รายรับ") : (CAT_LABELS[item.category] || "อื่นๆ");
  const accentColor = isIncome ? "#10b981" : "#6366f1";

  // Split expense categories into rows of 3
  const rows: string[][] = [];
  for (let i = 0; i < groupCats.length; i += 3) rows.push(groupCats.slice(i, i + 3));

  return {
    type: "flex",
    altText: `${item.vendor} ${Number(item.amount).toLocaleString("th-TH")} บาท`,
    contents: {
      type: "bubble",
      styles: { body: { backgroundColor: "#ffffff" }, footer: { backgroundColor: "#f8f8f8" } },
      body: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "20px",
        contents: [
          { type: "text", text: isIncome ? "รายรับ" : "รายจ่าย", size: "xs", color: isIncome ? "#10b981" : "#ef4444", weight: "bold" },
          { type: "text", text: item.vendor, weight: "bold", size: "lg", color: "#111111" },
          { type: "text", text: `${Number(item.amount).toLocaleString("th-TH")} บาท`, size: "xxl", weight: "bold", color: accentColor, margin: "xs" },
          { type: "separator", margin: "md" },
          { type: "box", layout: "horizontal", margin: "md", contents: [
            { type: "text", text: isIncome ? "ประเภท" : "หมวด", size: "sm", color: "#888888", flex: 2 },
            { type: "text", text: label, size: "sm", color: "#111111", flex: 3, weight: "bold" },
          ]},
          ...(item.sub_category ? [{ type: "box", layout: "horizontal", contents: [
            { type: "text", text: "หมวดย่อย", size: "sm", color: "#888888", flex: 2 },
            { type: "text", text: item.sub_category, size: "sm", color: "#111111", flex: 3, weight: "bold" },
          ]}] : []),
          ...(!isIncome ? [
            { type: "separator", margin: "md" },
            { type: "text", text: "เปลี่ยนหมวด:", size: "xs", color: "#aaaaaa", margin: "md" },
            ...rows.map(row => ({
              type: "box", layout: "horizontal", spacing: "xs", margin: "xs",
              contents: row.map(id => ({
                type: "button", height: "sm", flex: 1,
                style: id === item.category ? "primary" : "secondary",
                action: { type: "postback", label: CAT_LABELS[id] || id, data: `action=cat&id=${tempId}&cat=${id}`, displayText: CAT_LABELS[id] || id },
              })),
            })),
          ] : []),
        ],
      },
      footer: {
        type: "box", layout: "vertical", spacing: "xs", paddingAll: "14px",
        contents: [
          {
            type: "box", layout: "horizontal", spacing: "xs",
            contents: [
              { type: "button", style: "secondary", flex: 1, height: "sm", action: { type: "postback", label: "แก้จำนวน", data: `action=edit_amount&id=${tempId}`, displayText: "แก้จำนวนเงิน" } },
              { type: "button", style: "secondary", flex: 1, height: "sm", action: { type: "postback", label: "แก้ร้านค้า", data: `action=edit_vendor&id=${tempId}`, displayText: "แก้ชื่อร้านค้า" } },
            ],
          },
          {
            type: "box", layout: "horizontal", spacing: "xs",
            contents: [
              { type: "button", style: "secondary", flex: 1, height: "sm", action: { type: "postback", label: "ยกเลิก", data: `action=cancel&id=${tempId}`, displayText: "ยกเลิก" } },
              { type: "button", style: "primary", flex: 2, height: "sm", color: accentColor, action: { type: "postback", label: "บันทึก", data: `action=save&id=${tempId}`, displayText: "บันทึก" } },
            ],
          },
        ],
      },
    },
  };
}

export function buildReportText(summary: any): string {
  const lines = [
    `สรุปเดือนนี้`,
    `รายรับ: ${(summary.totalIncome||0).toLocaleString("th-TH")} บาท`,
    `รายจ่าย: ${(summary.totalExpense||0).toLocaleString("th-TH")} บาท`,
    `คงเหลือ: ${(summary.net||0).toLocaleString("th-TH")} บาท\n`,
  ];

  if (summary.byIncomeCategory && Object.keys(summary.byIncomeCategory).length > 0) {
    lines.push("รายรับ:");
    for (const [cat, amt] of Object.entries(summary.byIncomeCategory) as any) {
      lines.push(`  · ${cat}: ${amt.toLocaleString("th-TH")} บาท`);
    }
    lines.push("");
  }

  lines.push("รายจ่าย:");
  for (const [, d] of Object.entries(summary.byCategory) as any) {
    if (d.count > 0) lines.push(`  · ${d.label}: ${d.total.toLocaleString("th-TH")} บาท`);
  }

  lines.push(`\n${process.env.NEXT_PUBLIC_APP_URL}`);
  return lines.join("\n");
}