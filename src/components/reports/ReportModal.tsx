"use client";

import { useState } from "react";

const CATEGORIES = [
  { value: "suspected_scam", label: "Suspected Scam" },
  { value: "misleading_information", label: "Misleading Information" },
  { value: "harassment", label: "Harassment" },
  { value: "other", label: "Other" },
];

interface ReportModalProps {
  reporterId: string;
  reportedUserId?: string;
  reportedListingId?: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

export default function ReportModal({ reporterId, reportedUserId, reportedListingId, onClose, onSubmitted }: ReportModalProps) {
  const [category, setCategory] = useState("suspected_scam");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reporterId, reportedUserId, reportedListingId, category, description }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to submit report");
        return;
      }
      onSubmitted?.();
      onClose();
    } catch {
      setError("Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Report</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-[var(--text-secondary)] font-medium">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm">
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-[var(--text-secondary)] font-medium">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm min-h-[100px]"
              required maxLength={5000} placeholder="Describe the issue..." />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-[var(--border)] text-[var(--text-secondary)] rounded-lg text-sm">Cancel</button>
            <button type="submit" disabled={submitting || !description.trim()}
              className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50">
              {submitting ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
