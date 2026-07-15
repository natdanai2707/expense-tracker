# Expense Tracker — LINE Bot + Dashboard

บันทึกรายรับ-รายจ่ายส่วนตัวและธุรกิจของครอบครัว ผ่าน LINE Bot และ Web Dashboard
รองรับหลายกลุ่ม (แต่ละกลุ่มมีข้อมูลและหมวดหมู่แยกกัน)

**Stack:** Next.js 16 (App Router) · Supabase (Postgres + Storage) · LINE Messaging API + LIFF · Claude API (OCR ใบเสร็จ) · Vercel · Tailwind CSS · Recharts

---

## What it does

- **LINE Bot** — พิมพ์ `ค่าน้ำมัน 450` หรือ `รับ 50000 เงินเดือน` หรือส่งรูปใบเสร็จ → OCR → ยืนยันผ่าน Flex Message → บันทึก
- **Multi-group** — แต่ละกลุ่ม LINE มี dashboard ของตัวเองที่ `/g/[groupId]` ข้อมูลแยกกัน หมวดหมู่แยกกัน
- **Dashboard** — 7 แท็บ: รายการ · รายวัน (ปฏิทิน heatmap) · Pie · Bar · Budget · Trends · ธุรกิจ (P&L)
- **LIFF form** — แก้ไขรายการก่อนบันทึกได้จากในแอป LINE

---

## Architecture

```
LINE app ──► /api/webhook ──► parse / OCR ──► pending_actions ──► confirm ──► expenses
   │                                                                            ▲
   └──► LIFF form ──► /api/liff-save ──────────────────────────────────────────┘

Dashboard (/g/[groupId]) ──► /api/dashboard/[groupId]  (one round-trip: list+summary+trend+daily+config)
                          ├─► /api/expenses            (add / edit / delete)
                          ├─► /api/group-config/[id]   (name, categories, budgets)
                          ├─► /api/recurring/[id]       (auto rules)
                          └─► /api/export/[id]          (CSV)

Vercel Cron (monthly) ──► /api/cron/run-recurring ──► expenses
```

### `src/lib` (single source of truth)
| file | responsibility |
|------|----------------|
| `constants.ts` | categories, income categories, sub-categories, business map, parser keywords |
| `format.ts` | `thb()`, `baht()`, date label formatters |
| `dates.ts` | `monthRange()` (real calendar range — **never `-31`**), `daysInMonth`, `recentMonths`, … |
| `types.ts` | `Expense`, `MonthlySummary`, `DashboardData`, … |
| `supabase.ts` | client + all queries + `getDashboard()` consolidated fetch |
| `parser.ts` | text parsing, receipt OCR, Flex message builder |
| `pending.ts` | LINE confirmation state (DB-backed, in-memory fallback) |
| `line.ts` | LINE reply/push helpers with error surfacing |
| `storage.ts` | receipt image upload |
| `recurring.ts` | recurring-rule logic |

---

## Setup

### 1. Database migration
Supabase Dashboard → **SQL Editor** → New query → paste the contents of
[`supabase-migrations/001_full_schema.sql`](supabase-migrations/001_full_schema.sql) → **Run**.

The migration is **idempotent and non-destructive** (`add column if not exists`,
`create table if not exists`) — safe to run on the existing database and safe to
re-run. It adds any missing columns, indexes on `(group_id, date, type)`, the
`pending_actions` and `recurring_transactions` tables, seeds both groups, and
creates a public `receipts` storage bucket.

> The bot works before the migration too (pending state falls back to in-memory),
> but you should run it so bot confirmations survive across Vercel instances.

### 2. Environment variables
Create `.env.local` (local) and add the same keys in **Vercel → Settings → Environment Variables**:

| var | where to get it |
|-----|-----------------|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers → Messaging API |
| `LINE_CHANNEL_SECRET` | LINE Developers → Basic settings |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project settings → API |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `NEXT_PUBLIC_APP_URL` | your deployed URL, e.g. `https://expense-tracker.vercel.app` |
| `NEXT_PUBLIC_LIFF_ID` | LINE Developers → LIFF (e.g. `2010171939-stHRasQT`) |
| `CRON_SECRET` | *(optional)* random string; if set, protects the cron endpoint |

Never commit `.env.local` (it is gitignored).

### 3. Run locally
```bash
npm install
npm run dev       # http://localhost:3000  → redirects to the Surf group
npm run build     # production build (must stay green)
```

### 4. Deploy on Vercel
1. Import the GitHub repo in Vercel
2. Add all env vars above
3. Deploy — the `vercel.json` cron (`/api/cron/run-recurring`, 1st of each month) is picked up automatically

### 5. LINE configuration
1. **Messaging API** → Webhook URL: `https://YOUR-APP.vercel.app/api/webhook` → Verify → enable "Use webhook", disable "Auto-reply messages"
2. **LIFF** → add an app with Endpoint URL `https://YOUR-APP.vercel.app/liff`, size *Tall*, scope `profile` — copy the LIFF ID into `NEXT_PUBLIC_LIFF_ID`
3. Add the bot to the LINE group

---

## Usage

| ส่ง | ผล |
|-----|-----|
| รูปใบเสร็จ | OCR อัตโนมัติ + เก็บรูปต้นฉบับ |
| `ค่าน้ำมัน 450` | บันทึกรายจ่าย (เดา หมวด/หมวดย่อย ให้) |
| `รับ 50000 เงินเดือน` | บันทึกรายรับ |
| `/report` · `/สรุป` | สรุปเดือนนี้ |
| `/link` · `/dashboard` | ลิงก์ Dashboard |
| `/help` · `/คู่มือ` | คู่มือ |

### Categories
`personal` ส่วนตัว · `with_layers` WITH LAYERS · `met` MET Furniture ·
`steel_s2000` S-2000 · `south_steel` เหล็กใต้ · `other` อื่นๆ

หมวดหมู่ต่อกลุ่มปรับได้ในตาราง `group_config.categories`.

### Groups (production)
| group_id | ชื่อ | หมวด |
|----------|------|------|
| `C174382191b4c63db85ae4a689ec99812` | Surf | ทั้งหมด |
| `C4827c4a2d8c9d62b2d2dba2e59aaee71` | แม่ | personal + other |

---

## Data model

**expenses** — `id, date, vendor, amount, category, sub_category, note, added_by,
line_user_id, group_id, type (income|expense), income_category, receipt_url, created_at`

**group_config** — `group_id, name, categories text[], budgets jsonb, created_at`

**pending_actions** — `id, payload jsonb, expires_at` (LINE confirmation state)

**recurring_transactions** — `id, group_id, day_of_month, type, vendor, amount,
category, sub_category, income_category, note, active, last_run`

---

## Notes for maintainers

- **Month ranges** always go through `monthRange()` in `lib/dates.ts`. Never build a
  filter with `-31` — it throws `date out of range` on a Postgres `date` column and
  silently empties the dashboard.
- The dashboard loads through **one** endpoint (`/api/dashboard/[groupId]`). Add new
  aggregated data there rather than adding another fetch on the client.
- Every API route wraps its work in `try/catch` and returns `{ error }` with a real
  status — surface errors, don't swallow them.
- `npm run build` must stay green.
