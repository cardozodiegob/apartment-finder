"use client";

interface TrustBadgeProps {
  score: number;
  badge: "new_user" | "trusted" | "flagged";
  size?: "sm" | "md";
}

export default function TrustBadge({ score, badge, size = "md" }: TrustBadgeProps) {
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";

  if (badge === "new_user") {
    return (
      <span className={`inline-flex items-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 font-medium ${sizeClasses}`}>
        New User
      </span>
    );
  }

  if (badge === "flagged") {
    return (
      <span className={`inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 font-medium ${sizeClasses}`}>
        ⚠ {score.toFixed(1)}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 font-medium ${sizeClasses}`}>
      ★ {score.toFixed(1)}
    </span>
  );
}
