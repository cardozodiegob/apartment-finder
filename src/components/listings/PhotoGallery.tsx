"use client";

import { useEffect, useRef, useState } from "react";
import type { PhotoValue } from "@/lib/listings/photoUrl";
import { photoUrl as getUrl } from "@/lib/listings/photoUrl";

interface PhotoGalleryProps {
  photos: PhotoValue[];
  title: string;
  floorPlanUrl?: string;
  virtualTourUrl?: string;
}

type Tab = "photos" | "floor_plan" | "virtual_tour";

/**
 * Gallery with thumbnail strip + keyboard-navigable lightbox.
 *
 * - Arrow keys navigate
 * - Escape closes the lightbox
 * - Swipe support on touch devices
 * - Lazy-loads off-screen thumbnails
 * - Falls back gracefully when `photos` is empty
 */
export default function PhotoGallery({
  photos,
  title,
  floorPlanUrl,
  virtualTourUrl,
}: PhotoGalleryProps) {
  const [tab, setTab] = useState<Tab>("photos");
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Dedupe + sort photos by their `order` field
  const ordered = [...photos]
    .map((p) => (typeof p === "string" ? { url: p, order: 0 } : p))
    .filter((p): p is { url: string; order: number; caption?: string; alt?: string } => !!p && !!p.url)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const activeUrl = ordered[active]?.url;
  const activeAlt = ordered[active]?.alt ?? `${title} — photo ${active + 1}`;
  const activeCaption = ordered[active]?.caption;

  const prev = () =>
    setActive((i) => (ordered.length === 0 ? 0 : (i - 1 + ordered.length) % ordered.length));
  const next = () =>
    setActive((i) => (ordered.length === 0 ? 0 : (i + 1) % ordered.length));

  useEffect(() => {
    if (!lightbox) return;
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(false);
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, ordered.length]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const end = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const dx = end - touchStartX.current;
    if (dx > 50) prev();
    else if (dx < -50) next();
    touchStartX.current = null;
  };

  const hasTabs = Boolean(floorPlanUrl || virtualTourUrl);

  return (
    <div>
      {hasTabs && (
        <div role="tablist" className="flex gap-2 mb-3">
          <button
            role="tab"
            aria-selected={tab === "photos"}
            onClick={() => setTab("photos")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === "photos" ? "bg-navy-500 text-white" : "border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--background-secondary)]"}`}
          >
            Photos
          </button>
          {floorPlanUrl && (
            <button
              role="tab"
              aria-selected={tab === "floor_plan"}
              onClick={() => setTab("floor_plan")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === "floor_plan" ? "bg-navy-500 text-white" : "border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--background-secondary)]"}`}
            >
              Floor plan
            </button>
          )}
          {virtualTourUrl && (
            <button
              role="tab"
              aria-selected={tab === "virtual_tour"}
              onClick={() => setTab("virtual_tour")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === "virtual_tour" ? "bg-navy-500 text-white" : "border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--background-secondary)]"}`}
            >
              Virtual tour
            </button>
          )}
        </div>
      )}

      {tab === "photos" && (
        <>
          <div
            className="relative aspect-video rounded-2xl overflow-hidden mb-3 bg-[var(--surface)] cursor-zoom-in"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onClick={() => ordered.length > 0 && setLightbox(true)}
          >
            {ordered.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-sm text-[var(--text-muted)]">
                No photos yet
              </div>
            ) : (
              <img
                src={activeUrl}
                alt={activeAlt}
                className="w-full h-full object-cover"
                loading="eager"
              />
            )}
            {ordered.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); prev(); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white hover:bg-black/70"
                  aria-label="Previous photo"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); next(); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white hover:bg-black/70"
                  aria-label="Next photo"
                >
                  ›
                </button>
                <span className="absolute bottom-2 right-2 text-xs text-white bg-black/50 rounded-full px-2 py-0.5">
                  {active + 1} / {ordered.length}
                </span>
              </>
            )}
          </div>

          {activeCaption && (
            <p className="text-sm text-[var(--text-muted)] mb-2">{activeCaption}</p>
          )}

          {ordered.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {ordered.map((p, i) => (
                <button
                  key={`${p.url}-${i}`}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 ${i === active ? "border-navy-500" : "border-transparent"}`}
                  aria-label={`Show photo ${i + 1}`}
                  aria-current={i === active}
                >
                  <img
                    src={getUrl(p)}
                    alt={p.alt ?? `${title} thumbnail ${i + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "floor_plan" && floorPlanUrl && (
        <div className="rounded-2xl overflow-hidden bg-[var(--surface)]">
          <img src={floorPlanUrl} alt={`${title} floor plan`} className="w-full" />
        </div>
      )}

      {tab === "virtual_tour" && virtualTourUrl && (
        <div className="rounded-2xl overflow-hidden bg-[var(--surface)] aspect-video">
          <iframe
            src={virtualTourUrl}
            title={`${title} virtual tour`}
            className="w-full h-full border-0"
            allow="fullscreen; xr-spatial-tracking"
          />
        </div>
      )}

      {/* Lightbox */}
      {lightbox && ordered.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(false)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 text-white text-2xl hover:bg-white/20"
            aria-label="Previous photo"
          >
            ‹
          </button>
          <img
            src={activeUrl}
            alt={activeAlt}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 text-white text-2xl hover:bg-white/20"
            aria-label="Next photo"
          >
            ›
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightbox(false); }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white text-xl hover:bg-white/20"
            aria-label="Close photo viewer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
