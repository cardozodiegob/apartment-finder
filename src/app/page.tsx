"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ShieldIcon, HandshakeIcon, StarIcon } from "@/components/icons";

const PLACEHOLDER_IMG = "https://placehold.co/800x500/dce4ff/3b5bdb?text=Apartment+Finder";
const LISTING_PLACEHOLDER_IMG = "https://placehold.co/400x300/e2e8f0/64748b?text=No+Photo";

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
          <img src={PLACEHOLDER_IMG} alt="Apartment buildings in a European city" className="w-full h-full object-cover" />
        </div>
        <div className="relative z-10 glass-lg rounded-2xl p-8 md:p-12 max-w-2xl mx-4 text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-[var(--text-primary)] mb-4">
            Find Your Home in Europe
          </h1>
          <p className="text-lg text-[var(--text-secondary)] mb-6">
            Safe, trusted apartment hunting for expats. Scam-free, verified listings with dual-party payment protection.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/search" className="px-6 py-3 min-h-[44px] inline-flex items-center bg-navy-500 text-white rounded-xl text-sm font-medium hover:bg-navy-600 transition-colors">
              Start Searching
            </Link>
            <Link href="/listings/new" className="px-6 py-3 min-h-[44px] inline-flex items-center border border-[var(--border)] text-[var(--text-secondary)] rounded-xl text-sm font-medium hover:bg-[var(--background-secondary)] transition-colors">
              Post a Listing
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {[
            { icon: <ShieldIcon size={40} className="text-navy-500" />, title: "Scam Protection", desc: "AI-powered scam detection analyzes every listing before publishing" },
            { icon: <HandshakeIcon size={40} className="text-navy-500" />, title: "Dual-Party Payments", desc: "Escrow-based payments require confirmation from both parties" },
            { icon: <StarIcon size={40} className="text-navy-500" />, title: "Trust Scores", desc: "Community-driven trust system with verified reviews and badges" },
          ].map((f) => (
            <div key={f.title} className="glass-card text-center">
              <span className="mb-3 flex justify-center">{f.icon}</span>
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
                src={listing?.photos?.[0] || LISTING_PLACEHOLDER_IMG}
                alt={listing?.title || "Listing placeholder"}
                className="w-full h-40 object-cover rounded-lg mb-3"
                onError={(e) => { (e.target as HTMLImageElement).src = LISTING_PLACEHOLDER_IMG; }}
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
