"use client";
import { useState } from "react";
import type { Cat } from "./EditForm";

export interface Filters {
  q: string;
  min: string;
  max: string;
}

export function SearchFilter({ filters, onChange, cats, catFilter, onCatFilter }: {
  filters: Filters;
  onChange: (f: Filters) => void;
  cats: Cat[];
  catFilter: string;
  onCatFilter: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = filters.q || filters.min || filters.max;

  return (
    <div className="mb-2.5">
      <div className="flex gap-2">
        <input
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          placeholder="ค้นหาร้านค้า / หมายเหตุ..."
          className="min-w-0 flex-1 rounded-pill border border-white/10 bg-white/[0.06] px-4 py-2 text-[13px] text-ink outline-none placeholder:text-ink-ghost"
        />
        <button onClick={() => setOpen((o) => !o)}
          className={`shrink-0 rounded-pill border px-3.5 py-2 text-xs ${active || open ? "border-accent bg-accent/20 text-accent-soft" : "border-white/10 text-ink-muted"}`}>
          ตัวกรอง{active ? " •" : ""}
        </button>
      </div>

      {open && (
        <div className="mt-2 animate-fade-in rounded-card border border-line bg-white/[0.03] p-3">
          <div className="mb-2 flex items-center gap-2">
            <input type="number" inputMode="numeric" value={filters.min} onChange={(e) => onChange({ ...filters, min: e.target.value })}
              placeholder="ยอดต่ำสุด" className="w-full rounded-lg border border-white/12 bg-white/[0.07] px-2.5 py-2 text-sm text-ink outline-none" />
            <span className="text-ink-faint">–</span>
            <input type="number" inputMode="numeric" value={filters.max} onChange={(e) => onChange({ ...filters, max: e.target.value })}
              placeholder="ยอดสูงสุด" className="w-full rounded-lg border border-white/12 bg-white/[0.07] px-2.5 py-2 text-sm text-ink outline-none" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => onCatFilter("all")}
              className={`rounded-pill border px-3 py-1 text-[11px] ${catFilter === "all" ? "border-accent bg-accent/20 text-accent-soft" : "border-white/10 text-ink-muted"}`}>
              ทุกหมวด
            </button>
            {cats.map((c) => (
              <button key={c.id} onClick={() => onCatFilter(catFilter === c.id ? "all" : c.id)}
                className="rounded-pill border px-3 py-1 text-[11px]"
                style={{
                  borderColor: catFilter === c.id ? c.color : "rgba(255,255,255,0.1)",
                  background: catFilter === c.id ? `${c.color}25` : "transparent",
                  color: catFilter === c.id ? c.color : "#9ca3af",
                }}>
                {c.label}
              </button>
            ))}
          </div>
          {active && (
            <button onClick={() => onChange({ q: "", min: "", max: "" })} className="mt-2.5 text-[11px] text-ink-faint underline">
              ล้างตัวกรอง
            </button>
          )}
        </div>
      )}
    </div>
  );
}
