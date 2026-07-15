"use client";

export interface ToastData {
  message: string;
  tone?: "info" | "error";
  action?: { label: string; onClick: () => void };
}

export function Toast({ toast, onDismiss }: { toast: ToastData | null; onDismiss: () => void }) {
  if (!toast) return null;
  const tone = toast.tone === "error" ? "border-expense/40 bg-expense/15 text-expense" : "border-white/10 bg-surface-raised text-ink";
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4">
      <div className={`pointer-events-auto flex animate-fade-in items-center gap-3 rounded-pill border px-4 py-2.5 text-[13px] shadow-lg ${tone}`}>
        <span>{toast.message}</span>
        {toast.action && (
          <button onClick={() => { toast.action!.onClick(); onDismiss(); }} className="font-semibold text-accent-soft underline">
            {toast.action.label}
          </button>
        )}
        <button onClick={onDismiss} aria-label="ปิด" className="text-ink-faint">✕</button>
      </div>
    </div>
  );
}
