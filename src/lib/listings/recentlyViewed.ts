/**
 * Tiny helper for tracking recently-viewed listings in localStorage.
 * Capped at 20 most-recent distinct IDs.
 */

const KEY = "recentlyViewedListings";
const CAP = 20;

export function recordView(listingId: string): void {
  if (typeof window === "undefined" || !listingId) return;
  try {
    const raw = window.localStorage.getItem(KEY);
    const existing: string[] = raw ? JSON.parse(raw) : [];
    const deduped = [listingId, ...existing.filter((id) => id !== listingId)].slice(0, CAP);
    window.localStorage.setItem(KEY, JSON.stringify(deduped));
  } catch {
    /* storage unavailable — quietly drop */
  }
}

export function getRecentlyViewedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
