"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  autocompleteCity,
  EUROPEAN_COUNTRIES,
  extractCityName,
  type NominatimCity,
} from "@/lib/services/geography";

interface NavSearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Command-palette-style overlay for quick search from the navbar.
 * Typing filters European cities via the existing Nominatim-backed service.
 * Pressing Enter submits to /search with the selected city + country.
 */
export default function NavSearchOverlay({ open, onClose }: NavSearchOverlayProps) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [suggestions, setSuggestions] = useState<NominatimCity[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 10);
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Debounced lookup
  useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) { setSuggestions([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await autocompleteCity(q, country || undefined, ctrl.signal);
        setSuggestions(results);
        setHighlight(0);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, country, open]);

  const submit = (city?: string) => {
    const params = new URLSearchParams();
    if (country) params.set("country", country);
    if (city || q.trim()) params.set("city", city ?? q.trim());
    router.push(`/search?${params.toString()}`);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions[highlight]) submit(extractCityName(suggestions[highlight]));
      else submit();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
    >
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-xl glass-card z-10">
        <div className="flex gap-2 mb-3">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm"
            aria-label="Filter by country"
          >
            <option value="">All countries</option>
            {EUROPEAN_COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search city, neighbourhood, or keyword…"
            className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm"
            aria-label="Search query"
          />
        </div>

        {loading && <p className="text-xs text-[var(--text-muted)]">Searching…</p>}

        {suggestions.length > 0 && (
          <ul className="mt-1 max-h-72 overflow-y-auto" role="listbox">
            {suggestions.map((s, i) => {
              const name = extractCityName(s);
              return (
                <li key={s.place_id} role="option" aria-selected={i === highlight}>
                  <button
                    type="button"
                    onClick={() => submit(name)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm ${i === highlight ? "bg-navy-500 text-white" : "text-[var(--text-primary)] hover:bg-[var(--background-secondary)]"}`}
                  >
                    {name}
                    {s.address?.country ? (
                      <span className={`text-xs ${i === highlight ? "text-white/80" : "text-[var(--text-muted)]"}`}> — {s.address.country}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-3 text-xs text-[var(--text-muted)]">Enter to search · Esc to close</p>
      </div>
    </div>
  );
}
