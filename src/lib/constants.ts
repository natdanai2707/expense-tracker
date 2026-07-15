// ─────────────────────────────────────────────────────────────
// Single source of truth for categories, business mapping, groups.
// Imported by parser, webhook, LIFF, dashboard, API routes.
// ─────────────────────────────────────────────────────────────

export interface CategoryMeta {
  label: string;
  color: string;
}

export const CATEGORIES = {
  personal:    { label: "ส่วนตัว",      color: "#6366f1" },
  with_layers: { label: "WITH LAYERS",   color: "#f59e0b" },
  met:         { label: "MET Furniture", color: "#10b981" },
  steel_s2000: { label: "S-2000",        color: "#ef4444" },
  south_steel: { label: "เหล็กใต้",      color: "#f97316" },
  other:       { label: "อื่นๆ",         color: "#8b5cf6" },
} as const satisfies Record<string, CategoryMeta>;

export type CategoryId = keyof typeof CATEGORIES;

export const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[];

/** Fallback used when an unknown category id shows up in data. */
export const UNKNOWN_CATEGORY: CategoryMeta = { label: "อื่นๆ", color: "#8b5cf6" };

export function categoryMeta(id: string): CategoryMeta {
  return (CATEGORIES as Record<string, CategoryMeta>)[id] || { label: id, color: UNKNOWN_CATEGORY.color };
}

/** Short labels used in LINE flex buttons (space constrained). */
export const CATEGORY_SHORT_LABELS: Record<string, string> = {
  personal: "ส่วนตัว", with_layers: "WITH LAYERS", met: "MET",
  steel_s2000: "S-2000", south_steel: "เหล็กใต้", other: "อื่นๆ",
};

export const INCOME_CATEGORIES = [
  "เงินเดือน",
  "รายรับจาก MET",
  "รายรับจาก With Layers",
  "เงินปันผล",
  "ค่าเช่า",
  "เงินคืนบัตรเครดิต",
  "รายรับจากอื่นๆ",
] as const;

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

export const PERSONAL_SUB_CATEGORIES = [
  "ค่าอาหาร", "อาหารนอกบ้าน/คาเฟ่", "ค่าที่พัก/สาธารณูปโภค", "ค่าเดินทาง",
  "ค่ารักษาพยาบาล", "ช้อปปิ้ง", "สันทนาการ", "ท่องเที่ยว", "ของขวัญ", "การออม/ลงทุน", "อื่นๆ",
] as const;

/** Categories that map to a real business, for the P&L view. */
export interface Business {
  id: string;
  label: string;
  color: string;
  /** expense category ids that belong to this business */
  expenseCategories: CategoryId[];
  /** income_category strings that belong to this business */
  incomeCategories: string[];
}

export const BUSINESSES: Business[] = [
  { id: "met", label: "MET Furniture", color: "#10b981", expenseCategories: ["met"], incomeCategories: ["รายรับจาก MET"] },
  { id: "with_layers", label: "WITH LAYERS", color: "#f59e0b", expenseCategories: ["with_layers"], incomeCategories: ["รายรับจาก With Layers"] },
  { id: "steel_s2000", label: "S-2000", color: "#ef4444", expenseCategories: ["steel_s2000"], incomeCategories: [] },
  { id: "south_steel", label: "เหล็กใต้", color: "#f97316", expenseCategories: ["south_steel"], incomeCategories: [] },
];

/** Default category set for a newly-seen group. */
export const DEFAULT_CATEGORIES: CategoryId[] = ["personal", "other"];
export const DEFAULT_GROUP_NAME = "กลุ่มของฉัน";

/** The two existing production groups. */
export const KNOWN_GROUPS = {
  surf: "C174382191b4c63db85ae4a689ec99812",
  mae:  "C4827c4a2d8c9d62b2d2dba2e59aaee71",
} as const;

// ── Parser keyword maps ──────────────────────────────────────

export const SUB_CAT_KEYWORDS: Record<string, string[]> = {
  "ค่าอาหาร":              ["ข้าว", "อาหาร", "นม", "ขนม", "7-11", "เซเว่น", "ผัก", "เนื้อ", "น้ำ"],
  "อาหารนอกบ้าน/คาเฟ่":   ["กาแฟ", "คาเฟ่", "ร้านอาหาร", "ชาบู", "บุฟเฟ่", "sushi", "ซูชิ", "away"],
  "ค่าที่พัก/สาธารณูปโภค": ["เช่าบ้าน", "ค่าเช่า", "ค่าไฟ", "ค่าน้ำ", "internet", "subscription", "ส่วนกลาง"],
  "ค่าเดินทาง":            ["น้ำมัน", "grab", "bts", "mrt", "จอดรถ", "taxi", "เติมรถ"],
  "ค่ารักษาพยาบาล":        ["หมอ", "ยา", "โรงพยาบาล", "clinic"],
  "ช้อปปิ้ง":              ["shopee", "lazada", "รองเท้า", "เสื้อผ้า", "กระเป๋า"],
  "สันทนาการ":             ["บอล", "ปีนผา", "โค้ช", "นวด", "หนัง", "gym"],
  "ท่องเที่ยว":            ["ตั๋ว", "โรงแรม", "hotel", "ทริป", "เที่ยว"],
  "ของขวัญ":               ["ของขวัญ", "เลี้ยง", "gift"],
  "การออม/ลงทุน":          ["ออม", "kept", "ลงทุน", "หุ้น", "กองทุน"],
};

export const INCOME_KEYWORDS: Record<string, string[]> = {
  "เงินเดือน":              ["เงินเดือน", "salary"],
  "รายรับจาก MET":         ["met", "รายรับ met"],
  "รายรับจาก With Layers": ["with layers", "withlayers", "layers", "wl"],
  "เงินปันผล":             ["ปันผล", "dividend"],
  "ค่าเช่า":               ["รับค่าเช่า", "rent income"],
  "เงินคืนบัตรเครดิต":     ["คืนบัตร", "cashback", "เงินคืน"],
  "รายรับจากอื่นๆ":        ["รายรับ", "ได้รับ", "โอนเข้า", "รับเงิน"],
};

export const INCOME_TRIGGER = ["รับ", "ได้รับ", "income", "รายรับ", "เงินเดือน", "ปันผล", "cashback", "เงินคืน"];

export const CAT_KEYWORDS: Record<CategoryId, string[]> = {
  personal:    ["ส่วนตัว", "personal"],
  with_layers: ["with layers", "withlayers", "wl", "layers", "kerry", "j&t", "flash", "ไปรษณีย์", "แพ็ค", "ปากกา", "refill"],
  met:         ["met", "เฟอร์นิเจอร์", "furniture", "สแตนเลส", "อลูมิเนียม"],
  steel_s2000: ["s-2000", "s2000", "เบิก s2000"],
  south_steel: ["เหล็กใต้", "south steel", "southsteel"],
  other:       [],
};
