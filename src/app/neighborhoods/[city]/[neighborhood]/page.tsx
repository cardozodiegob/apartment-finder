"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

const NeighborhoodMap = dynamic(() => import("@/components/listings/ListingDetailMap"), { ssr: false });

interface Guide {
  _id: string;
  city: string;
  neighborhood: string;
  slug: string;
  overview: string;
  transitScore?: number;
  transitInfo?: string;
  safetyInfo?: string;
  amenities?: { supermarkets: string[]; pharmacies: string[]; schools: string[]; parks: string[] };
  averageRent?: number;
  centerLat: number;
  centerLng: number;
  isPublished: boolean;
}

interface ListingItem {
  _id: string;
  title: string;
  monthlyRent: number;
  currency: string;
  propertyType: string;
  address: { city: string; neighborhood?: string; country: string };
}

export default function NeighborhoodGuidePage() {
  const params = useParams<{ city: string; neighborhood: string }>();
  const [guide, setGuide] = useState<Guide | null>(null);
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/neighborhoods");
        if (!res.ok) { setNotFound(true); setLoading(false); return; }
        const data = await res.json();
        const slug = `${decodeURIComponent(params.city)}-${decodeURIComponent(params.neighborhood)}`.toLowerCase();
        const found = (data.guides || []).find((g: Guide) =>
          g.slug.toLowerCase() === slug ||
          (g.city.toLowerCase() === decodeURIComponent(params.city).toLowerCase() &&
           g.neighborhood.toLowerCase() === decodeURIComponent(params.neighborhood).toLowerCase())
        );
        if (!found || !found.isPublished) { setNotFound(true); setLoading(false); return; }
        setGuide(found);

        // Fetch listings in this neighborhood
        const listRes = await fetch(`/api/search?city=${encodeURIComponent(found.city)}`);
        if (listRes.ok) {
          const listData = await listRes.json();
          setListings((listData.listings || []).slice(0, 6));
        }
      } catch { setNotFound(true); }
      finally { setLoading(false); }
    }
    load();
  }, [params.city, params.neighborhood]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Loading...</p>
      </div>
    );
  }

  if (notFound || !guide) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="glass-card text-center max-w-md">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Coming Soon</h1>
          <p className="text-[var(--text-muted)] mb-4">Information about this neighborhood is not yet available. Check back soon!</p>
          <Link href="/search" className="text-navy-500 hover:underline">Browse Listings</Link>
        </div>
      </div>
    );
  }

  const amenitySection = (label: string, items: string[]) => items.length > 0 ? (
    <div>
      <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-1">{label}</h4>
      <ul className="list-disc list-inside text-sm text-[var(--text-primary)] space-y-0.5">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-[var(--background)] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1">{guide.neighborhood}</h1>
        <p className="text-lg text-[var(--text-secondary)] mb-6">{guide.city}</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Overview */}
            <div className="glass-card">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Overview</h2>
              <div className="text-sm text-[var(--text-primary)] prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: guide.overview }} />
            </div>

            {/* Transit */}
            {(guide.transitScore !== undefined || guide.transitInfo) && (
              <div className="glass-card">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Transit</h2>
                {guide.transitScore !== undefined && (
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-14 h-14 rounded-full bg-navy-100 dark:bg-navy-900/30 flex items-center justify-center">
                      <span className="text-xl font-bold text-navy-600 dark:text-navy-300">{guide.transitScore}</span>
                    </div>
                    <span className="text-sm text-[var(--text-secondary)]">Transit Score (out of 100)</span>
                  </div>
                )}
                {guide.transitInfo && (
                  <div className="text-sm text-[var(--text-primary)] prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: guide.transitInfo }} />
                )}
              </div>
            )}

            {/* Safety */}
            {guide.safetyInfo && (
              <div className="glass-card">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Safety</h2>
                <div className="text-sm text-[var(--text-primary)] prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: guide.safetyInfo }} />
              </div>
            )}

            {/* Amenities */}
            {guide.amenities && (
              <div className="glass-card">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Nearby Amenities</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {amenitySection("Supermarkets", guide.amenities.supermarkets)}
                  {amenitySection("Pharmacies", guide.amenities.pharmacies)}
                  {amenitySection("Schools", guide.amenities.schools)}
                  {amenitySection("Parks", guide.amenities.parks)}
                </div>
              </div>
            )}

            {/* Listings in area */}
            {listings.length > 0 && (
              <div className="glass-card">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Listings in {guide.neighborhood}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {listings.map((l) => (
                    <Link key={l._id} href={`/listings/${l._id}`} className="p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--background-secondary)] transition-colors">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{l.title}</p>
                      <p className="text-xs text-[var(--text-muted)]">{l.currency} {l.monthlyRent}/mo · {l.propertyType}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {guide.averageRent && (
              <div className="glass-card">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Average Rent</h3>
                <p className="text-2xl font-bold text-[var(--text-primary)]">€{guide.averageRent.toLocaleString()}</p>
                <p className="text-xs text-[var(--text-muted)]">per month</p>
              </div>
            )}

            <div className="glass-card">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Map</h3>
              <div className="aspect-square rounded-lg overflow-hidden border border-[var(--border)]">
                <NeighborhoodMap lng={guide.centerLng} lat={guide.centerLat} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
