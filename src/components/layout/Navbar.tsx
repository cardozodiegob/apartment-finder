"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import LanguageSelector from "@/components/ui/LanguageSelector";
import CurrencySelector from "@/components/ui/CurrencySelector";
import { LogoIcon, SunIcon, MoonIcon, BellIcon } from "@/components/icons";

interface SessionUser {
  id: string;
  email: string;
  fullName?: string;
  role?: string;
  mongoId?: string;
  isSuspended?: boolean;
  suspensionReason?: string;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof document !== "undefined") return document.documentElement.classList.contains("dark");
    return false;
  });
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Check session on mount and when the page becomes visible again
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const data = await res.json();
          setUser(data.session?.user ?? null);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      }
    }

    checkSession();

    // Re-check session when tab becomes visible (e.g. after login redirect)
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkSession();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [pathname]);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/");
      router.refresh();
    } catch {
      // ignore
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <nav className="glass-nav sticky top-0 z-40">
      {user?.isSuspended && (
        <div className="bg-red-600 text-white text-center text-sm py-2 px-4">
          Your account is suspended{user.suspensionReason ? `: ${user.suspensionReason}` : ""}. You can view content but cannot create listings, send messages, or make payments.
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <LogoIcon size={24} /> ApartmentFinder
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-4">
          <Link href="/search" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Search</Link>
          {user && (
            <Link href="/dashboard/listings" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">My Listings</Link>
          )}
          <LanguageSelector />
          <CurrencySelector />
          <button onClick={toggleTheme} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--background-secondary)]" aria-label="Toggle theme">
            {darkMode ? <SunIcon size={20} /> : <MoonIcon size={20} />}
          </button>
          {user && (
            <button className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--background-secondary)] relative" aria-label="Notifications">
              <BellIcon size={20} />
            </button>
          )}
          {user ? (
            <div className="flex items-center gap-3">
              <div className="relative group">
                <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-navy-500 text-white flex items-center justify-center text-sm font-medium shrink-0">
                    {(user.fullName || user.email).charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-[var(--text-primary)] truncate max-w-[120px] hidden lg:block">
                    {user.fullName || user.email}
                  </span>
                </button>
                <div className="absolute right-0 top-full mt-1 w-48 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  {user.mongoId && (
                    <Link href={`/users/${user.mongoId}`} className="block px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)]">
                      My Profile
                    </Link>
                  )}
                  <Link href="/dashboard/listings" className="block px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)]">
                    My Listings
                  </Link>
                  <Link href="/dashboard/favorites" className="block px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)]">
                    Favorites
                  </Link>
                  <Link href="/dashboard/messages" className="block px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)]">
                    Messages
                  </Link>
                  {user.role === "admin" && (
                    <Link href="/admin" className="block px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)]">
                      Admin Panel
                    </Link>
                  )}
                  <hr className="my-1 border-[var(--border)]" />
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-[var(--background-secondary)] disabled:opacity-50"
                  >
                    {isLoggingOut ? "Signing out…" : "Sign Out"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <Link href="/login" className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600">Sign In</Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Toggle menu">
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
          {user && (
            <Link href="/dashboard/listings" className="block text-sm text-[var(--text-secondary)]" onClick={() => setMobileOpen(false)}>My Listings</Link>
          )}
          <div className="flex gap-2">
            <LanguageSelector />
            <CurrencySelector />
          </div>
          <div className="flex gap-2">
            <button onClick={toggleTheme} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[var(--border)]">{darkMode ? <SunIcon size={20} /> : <MoonIcon size={20} />}</button>
            {user ? (
              <button
                onClick={() => { setMobileOpen(false); handleLogout(); }}
                disabled={isLoggingOut}
                className="px-4 py-2 border border-[var(--border)] text-[var(--text-secondary)] rounded-lg text-sm font-medium"
              >
                {isLoggingOut ? "Signing out…" : "Sign Out"}
              </button>
            ) : (
              <Link href="/login" className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium" onClick={() => setMobileOpen(false)}>Sign In</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
