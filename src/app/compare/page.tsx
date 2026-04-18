"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCompare } from "@/lib/hooks/useCompare";

interface ListingData {
  _id: string;
  title: string;
  monthlyRent: number;
  currency: string;
  propertyType: string;
  floorArea?: number;
  availableRooms?: number;
  address: { street: string; city: string; neighborhood?: string; postalCode: string; country: string };
  availableDate: string;
  tags: string[];
  photos: string[];
}

const PLACEHOLDER_IMG = "https://placehold.co/400x300/e2e8f0/64748b?text=No+Photo";

export default function ComparePage() {
  const { comparedIds, removeFromCompare, clearCompare } = useCompare();
  const [listings, setListings] = useState<ListingData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (comparedIds.length === 0) { setLoading(false); return; }
    Promise.all(
      comparedIds.map((id) =>
        fetch(`/api/listings/${id}`).then((r) => r.ok ? r.json() : null).then((d) => d?.listing ?? null).catch(() => null)
      )
    ).then((results) => {
      setListings(results.filter(Boolean));
      setLoading(false);
    });
  }, [comparedIds]);

  const fields: { label: string; key: string; render: (l: ListingData) => string }[] = [
    { label: "Monthly Rent", key: "monthlyRent", render: (l) => `${l.currency} ${l.monthlyRent.toLocaleString()}` },
    { label: "Property Type", key: "propertyType", render: (l) => l.propertyType },
    { label: "Floor Area", key: "floorArea", render: (l) => l.floorArea ? `${l.floorArea} m²` : "—" },
    { label: "Rooms", key: "availableRooms", render: (l) => l.availableRooms?.toString() ?? "—" },
    { label: "Address", key: "address", render: (l) => `${l.address.street}, ${l.address.city}` },
    { label: "Country", key: "country", render: (l) => l.address.country },
    { label: "Available Date", key: "availableDate", render: (l) => new Date(l.availableDate).toLocaleDateString() },
    { label: "Tags", key: "tags", render: (l) => l.tags.length > 0 ? l.tags.join(", ") : "—" },
  ];

  const isDifferent = (key: string) => {
    if (listings.length < 2) return false;
    const vals = listings.map((l) => {
      const field = fields.find((f) => f.key === key);
      return field ? field.render(l) : "";
    });
    return new Set(vals).size > 1;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Loading comparison...</p>
      </div>
    );
  }

  if (listings.length < 2) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="glass-card text-center max-w-md">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Compare Listings</h1>
          <p className="text-[var(--text-muted)] mb-4">Select at least 2 listings from the search page to compare them side by side.</p>
          <Link href="/search" className="text-navy-500 hover:underline">Go to Search</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Compare Listings</h1>
          <div className="flex gap-2">
            <button onClick={clearCompare} className="px-3 py-1.5 text-sm border border-[var(--border)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--background-secondary)] btn-press">
              Clear All
            </button>
            <Link href="/search" className="px-3 py-1.5 text-sm text-navy-500 hover:underline">Back to Search</Link>
          </div>
        </div>

        {/* Desktop: Table layout */}
        <div className="hidden md:block glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-3 px-4 text-[var(--text-secondary)] w-36">Field</th>
                {listings.map((l) => (
                  <th key={l._id} className="text-left py-3 px-4">
                    <div className="flex items-center gap-2">
                      <img src={l.photos?.[0] || PLACEHOLDER_IMG} alt={l.title} className="w-12 h-12 rounded-lg object-cover" />
                      <div>
                        <Link href={`/listings/${l._id}`} className="text-[var(--text-primary)] font-semibold hover:underline text-sm">{l.title}</Link>
                        <button onClick={() => removeFromCompare(l._id)} className="block text-xs text-red-500 hover:underline mt-0.5">Remove</button>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.key} className="border-b border-[var(--border)]">
                  <td className="py-3 px-4 text-[var(--text-secondary)] font-medium">{field.label}</td>
                  {listings.map((l) => (
                    <td key={l._id} className={`py-3 px-4 text-[var(--text-primary)] ${isDifferent(field.key) ? "bg-yellow-50 dark:bg-yellow-900/10 font-semibold" : ""}`}>
                      {field.render(l)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: Card layout */}
        <div className="md:hidden space-y-4">
          {listings.map((l) => (
            <div key={l._id} className="glass-card">
              <div className="flex items-center gap-3 mb-4">
                <img src={l.photos?.[0] || PLACEHOLDER_IMG} alt={l.title} className="w-16 h-16 rounded-lg object-cover" />
                <div className="flex-1">
                  <Link href={`/listings/${l._id}`} className="text-[var(--text-primary)] font-semibold hover:underline">{l.title}</Link>
                  <button onClick={() => removeFromCompare(l._id)} className="block text-xs text-red-500 hover:underline mt-0.5">Remove</button>
                </div>
              </div>
              <div className="space-y-2">
                {fields.map((field) => (
                  <div key={field.key} className={`flex justify-between py-1.5 px-2 rounded ${isDifferent(field.key) ? "bg-yellow-50 dark:bg-yellow-900/10" : ""}`}>
                    <span className="text-sm text-[var(--text-secondary)]">{field.label}</span>
                    <span className={`text-sm text-[var(--text-primary)] ${isDifferent(field.key) ? "font-semibold" : ""}`}>{field.render(l)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
