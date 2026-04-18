"use client";

import { useState } from "react";
import Link from "next/link";
import LanguageSelector from "@/components/ui/LanguageSelector";
import CurrencySelector from "@/components/ui/CurrencySelector";
import { LogoIcon } from "@/components/icons";

const POPULAR_CITIES: Array<{ city: string; country: string }> = [
  { city: "Berlin", country: "Germany" },
  { city: "Paris", country: "France" },
  { city: "Amsterdam", country: "Netherlands" },
  { city: "Barcelona", country: "Spain" },
  { city: "Lisbon", country: "Portugal" },
  { city: "Vienna", country: "Austria" },
];

const SOCIAL_LINKS = [
  { name: "X", href: "https://x.com/apartmentfinder", icon: "𝕏" },
  { name: "Instagram", href: "https://instagram.com/apartmentfinder", icon: "◎" },
  { name: "LinkedIn", href: "https://linkedin.com/company/apartmentfinder", icon: "in" },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus(res.ok ? "done" : "error");
      if (res.ok) setEmail("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--background-secondary)]">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <LogoIcon size={20} />
              <span className="font-semibold text-[var(--text-primary)]">ApartmentFinder</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-3">
              Safe, trusted apartment hunting for expats in Europe.
            </p>
            <div className="flex gap-2 text-[var(--text-muted)] text-xs">
              <span>🔒 SSL secured</span>
              <span>·</span>
              <span>EU data residency</span>
            </div>
          </div>

          {/* Popular cities */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Popular cities</h3>
            <ul className="space-y-2">
              {POPULAR_CITIES.map((c) => (
                <li key={c.city}>
                  <Link
                    href={`/search?country=${encodeURIComponent(c.country)}&city=${encodeURIComponent(c.city)}`}
                    className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {c.city}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Legal</h3>
            <ul className="space-y-2">
              <li><Link href="/privacy" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Privacy policy</Link></li>
              <li><Link href="/terms" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Terms of service</Link></li>
              <li><Link href="/move-in-guarantee" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Move-in guarantee</Link></li>
              <li><Link href="/blog" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Blog</Link></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Newsletter</h3>
            <p className="text-xs text-[var(--text-muted)] mb-2">Monthly tips for finding a place in Europe.</p>
            <form onSubmit={subscribe} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm"
                required
              />
              <button
                type="submit"
                disabled={status === "sending"}
                className="px-3 py-1.5 rounded-lg bg-navy-500 text-white text-sm font-medium hover:bg-navy-600 disabled:opacity-50"
              >
                {status === "sending" ? "…" : "Subscribe"}
              </button>
            </form>
            {status === "done" && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">Subscribed — check your inbox.</p>
            )}
            {status === "error" && (
              <p className="text-xs text-red-500 mt-1">Could not subscribe, try again later.</p>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-6 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--text-muted)]">
            © {currentYear} ApartmentFinder. All rights reserved.
          </p>

          <div className="flex items-center gap-3">
            <LanguageSelector />
            <CurrencySelector />
            <div className="flex items-center gap-2">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--background-secondary)]"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
