"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import LanguageSelector from "@/components/ui/LanguageSelector";
import CurrencySelector from "@/components/ui/CurrencySelector";
import { LogoIcon, SunIcon, MoonIcon, BellIcon } from "@/components/icons";
import { useTheme } from "@/lib/context/ThemeContext";
import NotificationPanel from "@/components/notifications/NotificationPanel";
import NavSearchOverlay from "@/components/layout/NavSearchOverlay";

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
  const { resolvedTheme, toggleTheme } = useTheme();
  const darkMode = resolvedTheme === "dark";
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuFirstItemRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user ?? null);
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

  // Poll unread notification count every 60s while user is logged in
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function fetchCount() {
      try {
        const res = await fetch("/api/notifications?countOnly=true");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setUnreadCount(data.unreadCount ?? 0);
      } catch { /* ignore */ }
    }
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user]);

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

  // Keyboard: Escape closes, arrow keys navigate menu items
  useEffect(() => {
    if (!dropdownOpen) return;
    // Auto-focus first menu item when opening
    const t = setTimeout(() => menuFirstItemRef.current?.focus(), 0);

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDropdownOpen(false);
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = Array.from(
        dropdownRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
      );
      if (items.length === 0) return;
      const idx = items.findIndex((el) => el === document.activeElement);
      const next =
        e.key === "ArrowDown"
          ? (idx + 1) % items.length
          : (idx - 1 + items.length) % items.length;
      e.preventDefault();
      items[next]?.focus();
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", handleKey);
    };
  }, [dropdownOpen]);

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
        <div className="hidden md:flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border)] text-sm text-[var(--text-muted)] hover:bg-[var(--background-secondary)] transition-colors btn-press"
            aria-label="Open search"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
            </svg>
            <span className="hidden lg:inline">Search listings…</span>
          </button>
          {user && user.role === "poster" && (
            <Link href="/listings/new" className="px-3 py-1.5 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600 transition-colors btn-press">
              Post a Listing
            </Link>
          )}
          {user && user.role !== "poster" && (
            <Link href="/listings/new" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors btn-press">
              List your place
            </Link>
          )}
          {user && (
            <Link href="/dashboard/listings" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors btn-press">My Listings</Link>
          )}
          <LanguageSelector />
          <CurrencySelector />
          <button onClick={toggleTheme} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--background-secondary)] transition-colors btn-press" aria-label="Toggle theme">
            {darkMode ? <SunIcon size={20} /> : <MoonIcon size={20} />}
          </button>
          {user && (
            <button
              onClick={() => setNotifOpen((o) => !o)}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[var(--background-secondary)] transition-colors btn-press relative"
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
              aria-expanded={notifOpen}
            >
              <BellIcon size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
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
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-navy-400 to-navy-600 text-white flex items-center justify-center text-sm font-semibold shadow-sm">
                    {userInitial}
                  </div>
                  {user.role === "admin" && (
                    <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-purple-500 text-white text-[9px] font-bold leading-none border border-white dark:border-navy-900">
                      ADMIN
                    </span>
                  )}
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
                  role="menu"
                  aria-label="User menu"
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
                    <Link ref={menuFirstItemRef} role="menuitem" href={`/users/${user.mongoId}`} onClick={() => setDropdownOpen(false)} className="block px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)] transition-colors focus:bg-[var(--background-secondary)] focus:outline-none">
                      My Profile
                    </Link>
                  )}
                  <Link role="menuitem" href="/dashboard/listings" onClick={() => setDropdownOpen(false)} className="block px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)] transition-colors focus:bg-[var(--background-secondary)] focus:outline-none">
                    My Listings
                  </Link>
                  <Link role="menuitem" href="/dashboard/favorites" onClick={() => setDropdownOpen(false)} className="block px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)] transition-colors focus:bg-[var(--background-secondary)] focus:outline-none">
                    Favorites
                  </Link>
                  <Link role="menuitem" href="/dashboard/messages" onClick={() => setDropdownOpen(false)} className="block px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)] transition-colors focus:bg-[var(--background-secondary)] focus:outline-none">
                    Messages
                  </Link>
                  <Link role="menuitem" href="/dashboard/settings" onClick={() => setDropdownOpen(false)} className="block px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)] transition-colors focus:bg-[var(--background-secondary)] focus:outline-none">
                    Settings
                  </Link>

                  {user.role === "admin" && (
                    <>
                      <div className="h-px bg-[var(--border)] mx-3 my-1" />
                      <Link role="menuitem" href="/admin" onClick={() => setDropdownOpen(false)} className="block px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--background-secondary)] transition-colors focus:bg-[var(--background-secondary)] focus:outline-none">
                        Admin Panel
                      </Link>
                    </>
                  )}

                  <div className="h-px bg-[var(--border)] mx-3 my-1" />
                  <button
                    role="menuitem"
                    onClick={() => { setDropdownOpen(false); setShowLogoutConfirm(true); }}
                    disabled={isLoggingOut}
                    className="block w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-[var(--background-secondary)] transition-colors focus:bg-[var(--background-secondary)] focus:outline-none disabled:opacity-50"
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

        {/* Mobile hamburger + search */}
        <div className="md:hidden flex items-center gap-1">
          <Link
            href="/search"
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center btn-press"
            aria-label="Search"
          >
            <svg className="w-5 h-5 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
            </svg>
          </Link>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center btn-press" aria-label="Toggle menu">
            <svg className="w-6 h-6 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
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

      {/* Notification panel */}
      {user && (
        <NotificationPanel
          userId={user.mongoId ?? user.id}
          isOpen={notifOpen}
          onClose={() => setNotifOpen(false)}
        />
      )}

      {/* Search overlay */}
      <NavSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Sign-out confirmation */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowLogoutConfirm(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="signout-title"
            className="relative glass-card w-full max-w-sm z-10"
          >
            <h3 id="signout-title" className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              Sign out?
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              You&apos;ll need to sign in again to access your account.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 border border-[var(--border)] text-[var(--text-secondary)] rounded-lg text-sm btn-press"
                autoFocus
              >
                Cancel
              </button>
              <button
                onClick={async () => { setShowLogoutConfirm(false); await handleLogout(); }}
                disabled={isLoggingOut}
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 btn-press"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
