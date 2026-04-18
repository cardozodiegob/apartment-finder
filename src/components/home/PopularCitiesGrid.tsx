import Link from "next/link";

interface CityCount {
  city: string;
  country: string;
  count: number;
}

export default function PopularCitiesGrid({ cities }: { cities: CityCount[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {cities.map((c) => (
        <Link
          key={`${c.country}-${c.city}`}
          href={`/search?country=${encodeURIComponent(c.country)}&city=${encodeURIComponent(c.city)}`}
          className="glass-card hover:shadow-md transition-shadow p-4 block"
        >
          <p className="font-semibold text-[var(--text-primary)]">{c.city}</p>
          <p className="text-xs text-[var(--text-muted)]">{c.country}</p>
          <p className="text-xs text-navy-500 mt-1">{c.count} listings</p>
        </Link>
      ))}
    </div>
  );
}
