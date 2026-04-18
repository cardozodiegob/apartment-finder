"use client";

import { useEffect, useState } from "react";

/**
 * Client-side hook to read a feature-flag value. Backed by
 * /api/feature-flags/[name] — the underlying evaluation runs on the server
 * so the rollout bucket stays stable even when the JS changes.
 */
export function useFeatureFlag(name: string): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/feature-flags/${encodeURIComponent(name)}`)
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((data) => { if (!cancelled) setEnabled(Boolean(data.enabled)); })
      .catch(() => { if (!cancelled) setEnabled(false); });
    return () => { cancelled = true; };
  }, [name]);

  return enabled;
}
