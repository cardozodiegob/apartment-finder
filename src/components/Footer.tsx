"use client";

import Link from "next/link";
import LanguageSelector from "@/components/ui/LanguageSelector";
import CurrencySelector from "@/components/ui/CurrencySelector";
import { LogoIcon } from "@/components/icons";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--background-secondary)]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <LogoIcon size={20} />
              <span className="font-semibold text-[var(--text-primary)]">ApartmentFinder</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              Safe, trusted apartment hunting for expats in Europe.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/privacy" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Explore</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/search" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  Search Listings
                </Link>
              </li>
              <li>
                <Link href="/listings/new" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  Post a Listing
                </Link>
              </li>
            </ul>
          </div>

          {/* Preferences */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Preferences</h3>
            <div className="flex flex-col gap-2">
              <LanguageSelector />
              <CurrencySelector />
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-6 border-t border-[var(--border)] text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            &copy; {currentYear} ApartmentFinder. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
