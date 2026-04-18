"use client";

import Link from "next/link";
import { firstPhotoUrl, type PhotoValue } from "@/lib/listings/photoUrl";

interface StripListing {
  _id: string;
  title: string;
  monthlyRent: number;
  currency: string;
  photos: PhotoValue[];
  address?: { city?: string; country?: string };
  propertyType: string;
}

interface HorizontalListingStripProps {
  title: string;
  listings: StripListing[];
}

export default function HorizontalListingStrip({ title, listings }: HorizontalListingStripProps) {
  if (!listings || listings.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{title}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {listings.map((l) => {
          const photo = firstPhotoUrl(l.photos);
          return (
            <Link
              key={l._id}
              href={`/listings/${l._id}`}
              className="shrink-0 w-44 glass-card p-0 overflow-hidden card-hover"
            >
              {photo ? (
                <img src={photo} alt={l.title} className="w-full h-24 object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-24 bg-[var(--background-secondary)] flex items-center justify-center text-xs text-[var(--text-muted)]">
                  {l.propertyType}
                </div>
              )}
              <div className="p-2.5">
                <h3 className="text-xs font-medium text-[var(--text-primary)] line-clamp-1">{l.title}</h3>
                <p className="text-xs text-[var(--text-muted)] line-clamp-1">
                  {l.address?.city}{l.address?.country ? `, ${l.address.country}` : ""}
                </p>
                <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                  {l.currency} {l.monthlyRent.toLocaleString()}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
