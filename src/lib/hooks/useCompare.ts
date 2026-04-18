"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "compare_listing_ids";
const MAX_COMPARE = 3;

export function useCompare() {
  const [comparedIds, setComparedIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setComparedIds(parsed.slice(0, MAX_COMPARE));
      }
    } catch {
      // ignore
    }
  }, []);

  const persist = useCallback((ids: string[]) => {
    setComparedIds(ids);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // ignore
    }
  }, []);

  const addToCompare = useCallback(
    (id: string) => {
      setComparedIds((prev) => {
        if (prev.includes(id) || prev.length >= MAX_COMPARE) return prev;
        const next = [...prev, id];
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    },
    []
  );

  const removeFromCompare = useCallback(
    (id: string) => {
      setComparedIds((prev) => {
        const next = prev.filter((x) => x !== id);
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    },
    []
  );

  const clearCompare = useCallback(() => {
    persist([]);
  }, [persist]);

  return { comparedIds, addToCompare, removeFromCompare, clearCompare, isMaxed: comparedIds.length >= MAX_COMPARE };
}
