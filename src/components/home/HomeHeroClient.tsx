"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { EUROPEAN_COUNTRIES } from "@/lib/services/geography";

const Hero3D = dynamic(() => import("@/components/hero/Hero3D"), { ssr: false });

export default function HomeHeroClient() {
  const router = useRouter();
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [showHero3D, setShowHero3D] = useState(false);

  // Only mount Hero3D when the user has no "reduced motion" pref AND viewport is ≥ md
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const wide = window.matchMedia?.("(min-width: 768px)").matches;
    if (!reduced && wide) setShowHero3D(true);
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (country) params.set("country", country);
    if (city) params.set("city", city);
    if (priceMax) params.set("priceMax", priceMax);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <section className="relative h-[70vh] overflow-hidden flex items-center justify-center bg-gradient-to-br from-navy-50 via-white to-navy-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      {showHero3D && (
        <div className="absolute inset-0 z-0" style={{ width: "100%", height: "100%" }}>
          <Hero3D />
        </div>
      )}

      <div className="relative z-10 glass-premium rounded-2xl p-8 md:p-12 max-w-2xl mx-4 text-center">
        <h1 className="text-3xl md:text-5xl font-bold text-[var(--text-primary)] mb-4">Find Your Home in Europe</h1>
        <p className="text-lg text-[var(--text-secondary)] mb-6">Safe, trusted apartment hunting for expats.</p>

        <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2 mb-4">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm"
            aria-label="Country"
          >
            <option value="">Any country</option>
            {EUROPEAN_COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm"
            aria-label="City"
          />
          <input
            type="number"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            placeholder="Max €/mo"
            min="0"
            className="w-32 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm"
            aria-label="Max price"
          />
          <button type="submit" className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600">
            Search
          </button>
        </form>

        <div className="flex gap-3 justify-center flex-wrap">
          <Link href="/listings/new" className="px-6 py-3 border border-[var(--border)] text-[var(--text-secondary)] rounded-xl text-sm font-medium hover:bg-[var(--background-secondary)] btn-press">
            Post a Listing
          </Link>
        </div>
      </div>
    </section>
  );
}
