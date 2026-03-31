"use client";

import { useState } from "react";

interface ReviewFormProps {
  transactionId: string;
  reviewerId: string;
  reviewedUserId: string;
  onSubmitted?: () => void;
}

export default function ReviewForm({ transactionId, reviewerId, reviewedUserId, onSubmitted }: ReviewFormProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewerId, reviewedUserId, transactionId, rating, comment }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to submit review");
        return;
      }
      setComment("");
      setRating(5);
      onSubmitted?.();
    } catch {
      setError("Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card space-y-3">
      <h3 className="font-semibold text-[var(--text-primary)]">Leave a Review</h3>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} type="button" onClick={() => setRating(star)}
            className={`text-2xl ${star <= rating ? "text-yellow-500" : "text-gray-300"}`}>
            ★
          </button>
        ))}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Share your experience..."
        className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm min-h-[80px]"
        required maxLength={2000} />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" disabled={submitting || !comment.trim()}
        className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600 transition-colors disabled:opacity-50">
        {submitting ? "Submitting..." : "Submit Review"}
      </button>
    </form>
  );
}
