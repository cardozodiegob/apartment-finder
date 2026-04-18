import Link from "next/link";
import { firstPhotoUrl, type PhotoValue } from "@/lib/listings/photoUrl";

interface FeaturedListing {
  _id: string;
  title: string;
  monthlyRent: number;
  currency: string;
  photos: PhotoValue[];
  address?: { city?: string; country?: string };
  propertyType?: string;
}

export default function FeaturedListingsGrid({ listings }: { listings: FeaturedListing[] }) {
  if (listings.length === 0) {
    return (
      <div className="glass-card text-center py-12">
        <p className="text-[var(--text-muted)] mb-4">No featured listings yet</p>
        <Link href="/search" className="text-navy-500 hover:underline">Browse all listings</Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {listings.map((l) => {
        const photo = firstPhotoUrl(l.photos);
        return (
          <Link
            key={String(l._id)}
            href={`/listings/${l._id}`}
            className="glass-card card-hover block p-0 overflow-hidden"
          >
            {photo ? (
              <img src={photo} alt={l.title} className="w-full h-40 object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-40 bg-[var(--background-secondary)] flex items-center justify-center text-xs text-[var(--text-muted)]">
                {l.propertyType}
              </div>
            )}
            <div className="p-3">
              <h3 className="font-semibold text-[var(--text-primary)] truncate">{l.title}</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                {l.address?.city}{l.address?.country ? `, ${l.address.country}` : ""}
              </p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-lg font-bold text-navy-500">
                  {l.currency} {l.monthlyRent}/mo
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-navy-100 text-navy-700 dark:bg-navy-800 dark:text-navy-200">
                  {l.propertyType}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
