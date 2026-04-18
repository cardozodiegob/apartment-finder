"use client";

import { useEffect, useState } from "react";

interface ListingActionIconsProps {
  listingId: string;
  listingTitle: string;
  initialFavorited?: boolean;
}

/**
 * Breadcrumb + save/share/report row rendered at the top of the listing detail.
 * All icons are keyboard-focusable and have aria-labels.
 */
export default function ListingActionIcons({
  listingId,
  listingTitle,
  initialFavorited = false,
}: ListingActionIconsProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShareOpen(false);
        setReportOpen(false);
      }
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

  const toggleFavorite = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/favorites/${listingId}`, {
        method: favorited ? "DELETE" : "POST",
      });
      if (res.ok) setFavorited((prev) => !prev);
    } catch { /* ignore */ }
    setBusy(false);
  };

  const url =
    typeof window !== "undefined" ? window.location.href : `/listings/${listingId}`;
  const subject = encodeURIComponent(listingTitle);
  const body = encodeURIComponent(`Check out this listing:\n\n${url}`);

  const share = async (target: "copy" | "whatsapp" | "email" | "x") => {
    setShareOpen(false);
    if (target === "copy") {
      try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    } else if (target === "whatsapp") {
      window.open(`https://wa.me/?text=${body}`, "_blank", "noopener");
    } else if (target === "email") {
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    } else if (target === "x") {
      window.open(
        `https://twitter.com/intent/tweet?text=${subject}&url=${encodeURIComponent(url)}`,
        "_blank",
        "noopener",
      );
    }
  };

  const submitReport = async () => {
    if (!reportReason.trim()) return;
    setReportStatus("sending");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "listing",
          targetId: listingId,
          reason: reportReason.trim(),
        }),
      });
      setReportStatus(res.ok ? "sent" : "error");
      if (res.ok) {
        setReportReason("");
        setTimeout(() => {
          setReportOpen(false);
          setReportStatus("idle");
        }, 1200);
      }
    } catch {
      setReportStatus("error");
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Favorite */}
      <button
        type="button"
        onClick={toggleFavorite}
        disabled={busy}
        className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[var(--border)] hover:bg-[var(--background-secondary)] transition-colors btn-press"
        aria-label={favorited ? "Remove from favorites" : "Save to favorites"}
        aria-pressed={favorited}
      >
        <svg
          viewBox="0 0 24 24"
          className={`w-5 h-5 ${favorited ? "fill-red-500 stroke-red-500" : "fill-none stroke-current text-[var(--text-primary)]"}`}
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z"
          />
        </svg>
      </button>

      {/* Share */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShareOpen((o) => !o)}
          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[var(--border)] hover:bg-[var(--background-secondary)] transition-colors btn-press"
          aria-label="Share listing"
          aria-expanded={shareOpen}
          aria-haspopup="menu"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-[var(--text-primary)]" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4m0 0L8 6m4-4v13" />
          </svg>
        </button>
        {shareOpen && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-44 py-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg z-20"
          >
            <button role="menuitem" onClick={() => share("copy")} className="block w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)]">Copy link</button>
            <button role="menuitem" onClick={() => share("whatsapp")} className="block w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)]">WhatsApp</button>
            <button role="menuitem" onClick={() => share("email")} className="block w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)]">Email</button>
            <button role="menuitem" onClick={() => share("x")} className="block w-full text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)]">X</button>
          </div>
        )}
      </div>

      {/* Report */}
      <button
        type="button"
        onClick={() => setReportOpen(true)}
        className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[var(--border)] hover:bg-[var(--background-secondary)] transition-colors btn-press"
        aria-label="Report listing"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-[var(--text-primary)]" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 2H21l-3 6 3 6h-8.5l-1-2H5a2 2 0 00-2 2z" />
        </svg>
      </button>

      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setReportOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-dialog-title"
            className="relative glass-card w-full max-w-md z-10"
          >
            <h3 id="report-dialog-title" className="text-lg font-semibold text-[var(--text-primary)] mb-3">
              Report listing
            </h3>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              rows={4}
              placeholder="Describe the issue (scam, misleading, inappropriate content...)"
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm mb-3"
            />
            {reportStatus === "sent" && (
              <p className="text-xs text-green-600 dark:text-green-400 mb-2">Report submitted — thank you.</p>
            )}
            {reportStatus === "error" && (
              <p className="text-xs text-red-500 mb-2">Could not submit report. Try again later.</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReportOpen(false)}
                className="px-4 py-2 border border-[var(--border)] text-[var(--text-secondary)] rounded-lg text-sm btn-press"
              >
                Cancel
              </button>
              <button
                onClick={submitReport}
                disabled={!reportReason.trim() || reportStatus === "sending"}
                className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600 disabled:opacity-50 btn-press"
              >
                {reportStatus === "sending" ? "Sending…" : "Submit report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
