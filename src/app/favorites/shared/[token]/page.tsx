import Link from "next/link";
import { firstPhotoUrl, type PhotoValue } from "@/lib/listings/photoUrl";

interface SharedListing {
  _id: string;
  title: string;
  monthlyRent: number;
  currency: string;
  photos: PhotoValue[];
  address?: { city?: string; country?: string };
  propertyType?: string;
}

async function fetchShare(token: string): Promise<{ folderName?: string; listings: SharedListing[] }> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  try {
    const res = await fetch(`${base}/api/favorites/share/${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    if (!res.ok) return { listings: [] };
    return res.json();
  } catch {
    return { listings: [] };
  }
}

export default async function SharedFavoritesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await fetchShare(token);

  return (
    <div className="min-h-screen bg-[var(--background)] py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
          {data.folderName ? `Shared folder: ${data.folderName}` : "Shared favorites"}
        </h1>

        {data.listings.length === 0 ? (
          <p className="text-[var(--text-muted)]">No listings in this folder.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.listings.map((l) => (
              <Link
                key={l._id}
                href={`/listings/${l._id}`}
                className="glass-card card-hover p-0 overflow-hidden block"
              >
                <img
                  src={firstPhotoUrl(l.photos) || "/file.svg"}
                  alt={l.title}
                  className="w-full h-40 object-cover"
                />
                <div className="p-3">
                  <h3 className="font-medium text-sm text-[var(--text-primary)] truncate">{l.title}</h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {l.address?.city ?? ""}{l.address?.country ? `, ${l.address.country}` : ""}
                  </p>
                  <p className="text-sm font-semibold text-[var(--text-primary)] mt-1">
                    {l.currency} {l.monthlyRent.toLocaleString()}/mo
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
