"use client";

import { useCompare } from "@/lib/hooks/useCompare";

interface CompareButtonProps {
  listingId: string;
}

export default function CompareButton({ listingId }: CompareButtonProps) {
  const { comparedIds, addToCompare, removeFromCompare, isMaxed } = useCompare();
  const isSelected = comparedIds.includes(listingId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSelected) {
      removeFromCompare(listingId);
    } else if (!isMaxed) {
      addToCompare(listingId);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!isSelected && isMaxed}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors btn-press ${
        isSelected
          ? "bg-navy-500 text-white hover:bg-navy-600"
          : isMaxed
          ? "bg-[var(--background-secondary)] text-[var(--text-muted)] cursor-not-allowed opacity-50"
          : "border border-navy-500 text-navy-500 hover:bg-navy-50 dark:hover:bg-navy-900/20"
      }`}
      title={isMaxed && !isSelected ? "Max 3 listings to compare" : undefined}
    >
      {isSelected ? "Remove from Compare" : "Add to Compare"}
    </button>
  );
}
