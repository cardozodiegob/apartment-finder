"use client";

import { useState } from "react";
import Link from "next/link";
import LanguageSelector from "@/components/ui/LanguageSelector";
import CurrencySelector from "@/components/ui/CurrencySelector";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof document !== "undefined") return document.documentElement.classList.contains("dark");
    return false;
  });

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <nav className="glass-nav sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-[var(--text-primary)]">
          🏠 ApartmentFinder
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-4">
          <Link href="/search" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Search</Link>
          <Link href="/dashboard/listings" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">My Listings</Link>
          <LanguageSelector />
          <CurrencySelector />
          <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-[var(--background-secondary)]" aria-label="Toggle theme">
            {darkMode ? "☀️" : "🌙"}
          </button>
          <button className="p-2 rounded-lg hover:bg-[var(--background-secondary)] relative" aria-label="Notifications">
            🔔
          </button>
          <Link href="/login" className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600">Sign In</Link>
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2" aria-label="Toggle menu">
          <svg className="w-6 h-6 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden glass-lg p-4 space-y-3">
          <Link href="/search" className="block text-sm text-[var(--text-secondary)]" onClick={() => setMobileOpen(false)}>Search</Link>
          <Link href="/dashboard/listings" className="block text-sm text-[var(--text-secondary)]" onClick={() => setMobileOpen(false)}>My Listings</Link>
          <div className="flex gap-2">
            <LanguageSelector />
            <CurrencySelector />
          </div>
          <div className="flex gap-2">
            <button onClick={toggleTheme} className="p-2 rounded-lg border border-[var(--border)]">{darkMode ? "☀️" : "🌙"}</button>
            <Link href="/login" className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium">Sign In</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
