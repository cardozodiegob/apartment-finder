"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { firstPhotoUrl, type PhotoValue } from "@/lib/listings/photoUrl";

interface SimilarListing {
  _id: string;
  title: string;
  monthlyRent: number;
  currency: string;
  address?: { city: string; country: string; neighborhood?: string };
  photos: PhotoValue[];
  propertyType: string;
}

export default function SimilarListings({ listingId }: { listingId: string }) {
  const [items, setItems] = useState<SimilarListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/listings/similar?listingId=${encodeURIComponent(listingId)}`)
      .then((r) => (r.ok ? r.json() : { listings: [] }))
      .then((data) => { if (!cancelled) setItems(data.listings ?? []); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [listingId]);

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Similar listings</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((l) => {
          const photo = firstPhotoUrl(l.photos);
          return (
            <Link
              key={l._id}
              href={`/listings/${l._id}`}
              className="glass-card card-hover p-0 overflow-hidden block"
            >
              {photo ? (
                <img src={photo} alt={l.title} className="w-full h-32 object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-32 bg-[var(--background-secondary)] flex items-center justify-center text-xs text-[var(--text-muted)]">
                  {l.propertyType}
                </div>
              )}
              <div className="p-3">
                <h3 className="text-sm font-medium text-[var(--text-primary)] line-clamp-1">{l.title}</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  {l.address?.city}{l.address?.country ? `, ${l.address.country}` : ""}
                </p>
                <p className="text-sm font-semibold text-[var(--text-primary)] mt-1">
                  {l.currency} {l.monthlyRent.toLocaleString()}/mo
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
