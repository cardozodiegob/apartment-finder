"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='500' fill='%23dce4ff'%3E%3Crect width='800' height='500'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%233b5bdb' font-size='24'%3EApartment Finder%3C/text%3E%3C/svg%3E";

interface FeaturedListing {
  _id: string;
  title: string;
  monthlyRent: number;
  currency: string;
  photos: string[];
  address: { city: string; country: string };
  propertyType: string;
}

export default function HomePage() {
  const [featured, setFeatured] = useState<FeaturedListing[]>([]);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/search?limit=6")
      .then((r) => r.json())
      .then((data) => setFeatured(data.listings || []))
      .catch(() => {});
  }, []);

  // Parallax effect
  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        const scrollY = window.scrollY;
        heroRef.current.style.transform = `translateY(${scrollY * 0.3}px)`;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Hero Section with Parallax */}
      <section className="relative h-[70vh] overflow-hidden flex items-center justify-center">
        <div ref={heroRef} className="absolute inset-0 z-0">
          <img src={PLACEHOLDER_IMG} alt="Hero" className="w-full h-full object-cover" />
        </div>
        <div className="relative z-10 glass-lg rounded-2xl p-8 md:p-12 max-w-2xl mx-4 text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-[var(--text-primary)] mb-4">
            Find Your Home in Europe
          </h1>
          <p className="text-lg text-[var(--text-secondary)] mb-6">
            Safe, trusted apartment hunting for expats. Scam-free, verified listings with dual-party payment protection.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/search" className="px-6 py-3 bg-navy-500 text-white rounded-xl text-sm font-medium hover:bg-navy-600 transition-colors">
              Start Searching
            </Link>
            <Link href="/listings/new" className="px-6 py-3 border border-[var(--border)] text-[var(--text-secondary)] rounded-xl text-sm font-medium hover:bg-[var(--background-secondary)] transition-colors">
              Post a Listing
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {[
            { icon: "🛡️", title: "Scam Protection", desc: "AI-powered scam detection analyzes every listing before publishing" },
            { icon: "🤝", title: "Dual-Party Payments", desc: "Escrow-based payments require confirmation from both parties" },
            { icon: "⭐", title: "Trust Scores", desc: "Community-driven trust system with verified reviews and badges" },
          ].map((f) => (
            <div key={f.title} className="glass-card text-center">
              <span className="text-4xl mb-3 block">{f.icon}</span>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{f.title}</h3>
              <p className="text-sm text-[var(--text-secondary)]">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Featured Listings */}
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Featured Listings</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(featured.length > 0 ? featured : Array(6).fill(null)).map((listing, i) => (
            <div key={listing?._id || i} className="glass-card hover:scale-[1.02] transition-transform">
              <img
                src={listing?.photos?.[0] || PLACEHOLDER_IMG}
                alt={listing?.title || "Listing placeholder"}
                className="w-full h-40 object-cover rounded-lg mb-3"
                onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }}
              />
              <h3 className="font-semibold text-[var(--text-primary)] truncate">{listing?.title || "Loading..."}</h3>
              <p className="text-sm text-[var(--text-secondary)]">{listing?.address?.city || "City"}, {listing?.address?.country || "Country"}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-lg font-bold text-navy-500">
                  {listing ? `${listing.currency} ${listing.monthlyRent}/mo` : "—"}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-navy-100 text-navy-700 dark:bg-navy-800 dark:text-navy-200">
                  {listing?.propertyType || "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
