"use client";

interface ReviewCardProps {
  rating: number;
  comment: string;
  createdAt: string;
  reviewerName?: string;
}

export default function ReviewCard({ rating, comment, createdAt, reviewerName }: ReviewCardProps) {
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  const date = new Date(createdAt).toLocaleDateString();

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-yellow-500 text-sm">{stars}</span>
        <span className="text-xs text-[var(--text-muted)]">{date}</span>
      </div>
      <p className="text-sm text-[var(--text-primary)]">{comment}</p>
      {reviewerName && (
        <p className="text-xs text-[var(--text-muted)] mt-2">— {reviewerName}</p>
      )}
    </div>
  );
}
