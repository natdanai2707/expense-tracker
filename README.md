# Expense Tracker

LINE Bot + Web Dashboard บันทึกค่าใช้จ่ายส่วนตัวและธุรกิจ

## Stack
- Next.js 14 + Vercel
- Supabase (database)
- LINE Messaging API (bot)
- Claude API (OCR ใบเสร็จ)

---

## ขั้นตอน Setup

### 1. สร้าง Supabase Table
ไปที่ https://supabase.com/dashboard → project expense-tracker → SQL Editor → New query → copy เนื้อหาจากไฟล์ `supabase-setup.sql` → Run

### 2. Push ขึ้น GitHub
```bash
cd expense-tracker
git init
git add .
git commit -m "initial"
git remote add origin https://github.com/natdanai2707/expense-tracker.git
git push -u origin main
```

### 3. Deploy บน Vercel
1. vercel.com → New Project → import repo
2. ใส่ Environment Variables ทุกตัว (ดูด้านล่าง)
3. Deploy → เก็บ URL ที่ได้

### 4. ตั้ง Environment Variables บน Vercel
```
LINE_CHANNEL_ACCESS_TOKEN=   (token ที่ได้จาก LINE Developers)
LINE_CHANNEL_SECRET=         (secret จาก LINE Developers)
NEXT_PUBLIC_SUPABASE_URL=    https://jcqmplhjtsbzljmhmvkl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=  (anon key จาก Supabase)
ANTHROPIC_API_KEY=           (จาก console.anthropic.com)
NEXT_PUBLIC_APP_URL=         (URL ของ Vercel app)
```

### 5. ตั้ง Webhook บน LINE
1. LINE Developers Console → เลือก channel
2. Messaging API tab → Webhook URL:
   `https://YOUR-APP.vercel.app/api/webhook`
3. กด Verify → ต้องขึ้น Success
4. เปิด "Use webhook"
5. ปิด "Auto-reply messages"

### 6. เพิ่ม Bot เข้า LINE Group
เพิ่มสมาชิกใน group → ค้นหา Bot ด้วย LINE ID จาก LINE Developers

---

## วิธีใช้งาน

| คำสั่ง | ผล |
|--------|-----|
| ส่งรูปใบเสร็จ | Bot อ่าน OCR อัตโนมัติ |
| `ค่าน้ำมัน 450 ส่วนตัว` | บันทึกรายจ่ายทันที |
| `Kerry 1200 with_layers` | บันทึกหมวด WITH LAYERS |
| `/report` | สรุปค่าใช้จ่ายเดือนนี้ |
| `/link` | ลิงก์ไปที่ Dashboard |
| `/help` | คู่มือการใช้งาน |

## หมวดหมู่

| ID | ชื่อ |
|----|------|
| personal | ส่วนตัว |
| with_layers | WITH LAYERS |
| met | MET Furniture |
| steel | เหล็กใต้ / S-2000 |
| other | อื่นๆ |
