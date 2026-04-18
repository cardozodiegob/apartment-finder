"use client";

import { useState, useEffect, useRef } from "react";
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Read actual dark mode state after hydration
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark") || localStorage.getItem("theme") === "dark";
    setDarkMode(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

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

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkSession();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      setDropdownOpen(false);
      router.push("/");
      router.refresh();
    } catch {
      // ignore
    } finally {
      setIsLoggingOut(false);
    }
  }

  const userInitial = user ? (user.fullName || user.email).charAt(0).toUpperCase() : "";

  return (
    <nav className="glass-nav sticky top-0 z-40" role="navigation" aria-label="Main navigation">
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
          <Link href="/search" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors btn-press">Search</Link>
          {user && (
            <Link href="/dashboard/listings" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors btn-press">My Listings</Link>
          )}
          <LanguageSelector />
          <CurrencySelector />
          <button onClick={toggleTheme} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--background-secondary)] transition-colors btn-press" aria-label="Toggle theme">
            {darkMode ? <SunIcon size={20} /> : <MoonIcon size={20} />}
          </button>
          {user && (
            <button className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--background-secondary)] transition-colors btn-press relative" aria-label="Notifications">
              <BellIcon size={20} />
            </button>
          )}
          {user ? (
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 transition-opacity btn-press"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-navy-400 to-navy-600 text-white flex items-center justify-center text-sm font-semibold shrink-0 shadow-sm">
                  {userInitial}
                </div>
                <span className="text-sm text-[var(--text-primary)] truncate max-w-[120px] hidden lg:block">
                  {user.fullName || user.email}
                </span>
                <svg className={`w-4 h-4 text-[var(--text-muted)] transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {dropdownOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-56 py-2 rounded-2xl border border-[var(--glass-border)] bg-white/95 dark:bg-[#0c1754]/95 backdrop-blur-2xl shadow-xl ring-1 ring-black/5 dark:ring-white/10 z-50"
                  style={{ animation: "dropdown-enter 0.2s ease" }}
                >
                  {/* User info header */}
                  <div className="px-4 py-2 mb-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{user.fullName || user.email}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
                  </div>
                  <div className="h-px bg-[var(--border)] mx-3 mb-1" />

                  {user.mongoId && (
                    <Link href={`/users/${user.mongoId}`} onClick={() => setDropdownOpen(false)} className="block px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)] transition-colors">
                      My Profile
                    </Link>
                  )}
                  <Link href="/dashboard/listings" onClick={() => setDropdownOpen(false)} className="block px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)] transition-colors">
                    My Listings
                  </Link>
                  <Link href="/dashboard/favorites" onClick={() => setDropdownOpen(false)} className="block px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)] transition-colors">
                    Favorites
                  </Link>
                  <Link href="/dashboard/messages" onClick={() => setDropdownOpen(false)} className="block px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)] transition-colors">
                    Messages
                  </Link>
                  <Link href="/dashboard/settings" onClick={() => setDropdownOpen(false)} className="block px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)] transition-colors">
                    Settings
                  </Link>

                  {user.role === "admin" && (
                    <>
                      <div className="h-px bg-[var(--border)] mx-3 my-1" />
                      <Link href="/admin" onClick={() => setDropdownOpen(false)} className="block px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)] transition-colors">
                        Admin Panel
                      </Link>
                    </>
                  )}

                  <div className="h-px bg-[var(--border)] mx-3 my-1" />
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="block w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-[var(--background-secondary)] transition-colors disabled:opacity-50"
                  >
                    {isLoggingOut ? "Signing out…" : "Sign Out"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600 transition-colors btn-press">Sign In</Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center btn-press" aria-label="Toggle menu">
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
      <div
        className={`md:hidden overflow-hidden transition-all duration-200 ease-in-out ${mobileOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="glass-lg p-4 space-y-3">
          <Link href="/search" className="block text-sm text-[var(--text-secondary)] py-2 btn-press" onClick={() => setMobileOpen(false)}>Search</Link>
          {user && (
            <>
              <Link href="/dashboard/listings" className="block text-sm text-[var(--text-secondary)] py-2 btn-press" onClick={() => setMobileOpen(false)}>My Listings</Link>
              <Link href="/dashboard/favorites" className="block text-sm text-[var(--text-secondary)] py-2 btn-press" onClick={() => setMobileOpen(false)}>Favorites</Link>
              <Link href="/dashboard/messages" className="block text-sm text-[var(--text-secondary)] py-2 btn-press" onClick={() => setMobileOpen(false)}>Messages</Link>
              <Link href="/dashboard/settings" className="block text-sm text-[var(--text-secondary)] py-2 btn-press" onClick={() => setMobileOpen(false)}>Settings</Link>
              {user.role === "admin" && (
                <Link href="/admin" className="block text-sm text-[var(--text-secondary)] py-2 btn-press" onClick={() => setMobileOpen(false)}>Admin Panel</Link>
              )}
              <div className="h-px bg-[var(--border)] my-1" />
            </>
          )}
          <div className="flex gap-2">
            <LanguageSelector />
            <CurrencySelector />
          </div>
          <div className="flex gap-2">
            <button onClick={toggleTheme} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[var(--border)] btn-press">{darkMode ? <SunIcon size={20} /> : <MoonIcon size={20} />}</button>
            {user ? (
              <button
                onClick={() => { setMobileOpen(false); handleLogout(); }}
                disabled={isLoggingOut}
                className="px-4 py-2 border border-[var(--border)] text-[var(--text-secondary)] rounded-lg text-sm font-medium btn-press"
              >
                {isLoggingOut ? "Signing out…" : "Sign Out"}
              </button>
            ) : (
              <Link href="/login" className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium btn-press" onClick={() => setMobileOpen(false)}>Sign In</Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
