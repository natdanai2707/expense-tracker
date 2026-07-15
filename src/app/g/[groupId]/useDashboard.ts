"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardData, Expense } from "@/lib/types";

interface State {
  data: DashboardData | null;
  loading: boolean;   // true only when there is nothing cached to show
  error: string | null;
}

/**
 * Loads the whole dashboard in a single round-trip and caches it per month.
 * Switching back to a visited month is instant (served from cache) while a
 * background revalidation refreshes it. Mutations update the cache optimistically.
 */
export function useDashboard(groupId: string, month: string) {
  const cache = useRef<Map<string, DashboardData>>(new Map());
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });
  const reqId = useRef(0);

  const fetchMonth = useCallback(async (m: string, { silent }: { silent?: boolean } = {}) => {
    const id = ++reqId.current;
    const cached = cache.current.get(m);
    setState((s) => ({ data: cached ?? (m === month ? s.data : null), loading: !cached && !silent, error: null }));
    try {
      const res = await fetch(`/api/dashboard/${groupId}?month=${m}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `โหลดข้อมูลไม่สำเร็จ (${res.status})`);
      }
      const data: DashboardData = await res.json();
      cache.current.set(m, data);
      if (id === reqId.current) setState({ data, loading: false, error: null });
    } catch (e) {
      if (id === reqId.current) {
        setState((s) => ({ data: s.data, loading: false, error: e instanceof Error ? e.message : "เกิดข้อผิดพลาด" }));
      }
    }
  }, [groupId, month]);

  useEffect(() => { fetchMonth(month); }, [month, fetchMonth]);

  const revalidate = useCallback(() => { fetchMonth(month, { silent: true }); }, [month, fetchMonth]);

  /** Apply an optimistic transform to the current month, then revalidate. */
  const mutate = useCallback((transform: (expenses: Expense[]) => Expense[]) => {
    setState((s) => {
      if (!s.data) return s;
      const expenses = transform(s.data.expenses);
      const next = { ...s.data, expenses };
      cache.current.set(month, next);
      return { ...s, data: next };
    });
  }, [month]);

  /** Drop cache for the current month (used after a config/budget change). */
  const invalidate = useCallback(() => { cache.current.delete(month); }, [month]);

  return { ...state, revalidate, mutate, invalidate };
}
