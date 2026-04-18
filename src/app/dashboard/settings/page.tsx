"use client";

import { useState, useEffect, useRef } from "react";
import { useToast } from "@/lib/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";
import { useTheme } from "@/lib/context/ThemeContext";

interface ProfileData {
  _id: string;
  fullName: string;
  bio: string;
  phone: string;
  dateOfBirth: string;
  nationality: string;
  idType: string;
  idNumber: string;
  profilePhoto: string;
  profileCompleteness: number;
  profileCompleted: boolean;
  idVerified: boolean;
  languagesSpoken: string[];
}

const REQUIRED_FIELDS: { key: keyof ProfileData; label: string }[] = [
  { key: "fullName", label: "Full Name" },
  { key: "phone", label: "Phone" },
  { key: "dateOfBirth", label: "Date of Birth" },
  { key: "nationality", label: "Nationality" },
  { key: "idType", label: "ID Type" },
  { key: "idNumber", label: "ID Number" },
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "it", label: "Italiano" },
];

const CURRENCIES = [
  "EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "BRL",
];

interface NotifPrefs {
  email: boolean;
  inApp: boolean;
  payment: boolean;
  security: boolean;
  listing: boolean;
  report: boolean;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileData>({
    _id: "", fullName: "", bio: "", phone: "", dateOfBirth: "",
    nationality: "", idType: "", idNumber: "", profilePhoto: "",
    profileCompleteness: 0, profileCompleted: false, idVerified: false,
    languagesSpoken: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toasts, toast, dismissToast } = useToast();

  // Preferences state
  const { resolvedTheme, toggleTheme } = useTheme();
  const darkMode = resolvedTheme === "dark";
  const [locale, setLocale] = useState("en");
  const [prefCurrency, setPrefCurrency] = useState("EUR");
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({
    email: true, inApp: true, payment: true, security: true, listing: true, report: true,
  });

  useEffect(() => {
    // Load preferences from client storage
    if (typeof window !== "undefined") {
      setPrefCurrency(localStorage.getItem("preferredCurrency") || "EUR");
      const cookieLocale = document.cookie.split("; ").find((c) => c.startsWith("locale="))?.split("=")[1];
      if (cookieLocale) setLocale(cookieLocale);
    }

    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.mongoId) {
          return fetch(`/api/users/${data.user.mongoId}/profile`).then((r) => r.ok ? r.json() : null);
        }
        return null;
      })
      .then((data) => {
        if (data?.user) {
          const u = data.user;
          setProfile({
            _id: u._id || "",
            fullName: u.fullName || "",
            bio: u.bio || "",
            phone: u.phone || "",
            dateOfBirth: u.dateOfBirth ? u.dateOfBirth.slice(0, 10) : "",
            nationality: u.nationality || "",
            idType: u.idType || "",
            idNumber: u.idNumber || "",
            profilePhoto: u.profilePhoto || "",
            profileCompleteness: u.profileCompleteness || 0,
            profileCompleted: u.profileCompleted || false,
            idVerified: u.idVerified || false,
            languagesSpoken: u.languagesSpoken || [],
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const missingFields = REQUIRED_FIELDS.filter((f) => !profile[f.key]);
  const completeness = Math.round(
    ((REQUIRED_FIELDS.length - missingFields.length) / REQUIRED_FIELDS.length) * 100
  );

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: profile.fullName,
          bio: profile.bio,
          phone: profile.phone,
          dateOfBirth: profile.dateOfBirth || undefined,
          nationality: profile.nationality || undefined,
          idType: profile.idType || undefined,
          idNumber: profile.idNumber || undefined,
          languagesSpoken: profile.languagesSpoken,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile((prev) => ({ ...prev, ...data.user, dateOfBirth: data.user.dateOfBirth ? data.user.dateOfBirth.slice(0, 10) : "" }));
        toast("Profile saved", "success");
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data.message || "Failed to save", "error");
      }
    } catch {
      toast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/users/me/photo", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setProfile((prev) => ({ ...prev, profilePhoto: data.url }));
        toast("Photo uploaded", "success");
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data.message || "Upload failed", "error");
      }
    } catch {
      toast("Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  function handleThemeToggle() {
    toggleTheme();
    toast(`Theme: ${darkMode ? "light" : "dark"}`, "success");
  }

  function handleLocaleChange(newLocale: string) {
    setLocale(newLocale);
    document.cookie = `locale=${newLocale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    toast(`Language: ${LANGUAGES.find((l) => l.code === newLocale)?.label || newLocale}`, "success");
  }

  function handleCurrencyChange(newCurrency: string) {
    setPrefCurrency(newCurrency);
    localStorage.setItem("preferredCurrency", newCurrency);
    window.dispatchEvent(new CustomEvent("currencyChange", { detail: newCurrency }));
    toast(`Currency: ${newCurrency}`, "success");
  }

  async function handleNotifToggle(key: keyof NotifPrefs) {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: updated }),
      });
      if (res.ok) {
        toast(`${key} notifications ${updated[key] ? "enabled" : "disabled"}`, "success");
      } else {
        setNotifPrefs(notifPrefs);
        toast("Failed to update notification preferences", "error");
      }
    } catch {
      setNotifPrefs(notifPrefs);
      toast("Failed to update notification preferences", "error");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] py-12">
        <div className="max-w-2xl mx-auto px-4 text-center text-[var(--text-muted)]">Loading…</div>
      </div>
    );
  }

  const inputCls = "w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm";

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Profile Settings</h1>

        {/* Progress bar */}
        <div className="glass-card mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Profile Completeness</span>
            <span className="text-sm font-bold text-[var(--text-primary)]">{completeness}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-[var(--background-secondary)]">
            <div
              className={`h-2 rounded-full transition-all ${completeness === 100 ? "bg-green-500" : "bg-navy-500"}`}
              style={{ width: `${completeness}%` }}
            />
          </div>
          {missingFields.length > 0 && (
            <p className="text-xs text-[var(--text-muted)] mt-2">
              Missing: {missingFields.map((f) => f.label).join(", ")}
            </p>
          )}
          {profile.idVerified ? (
            <p className="text-xs text-green-600 dark:text-green-400 mt-2">✓ Identity verified</p>
          ) : (
            <button
              onClick={async () => {
                try {
                  const res = await fetch("/api/kyc/start", { method: "POST" });
                  if (!res.ok) return;
                  const data = await res.json();
                  if (data.session?.url) window.location.href = data.session.url;
                } catch { /* ignore */ }
              }}
              className="mt-2 text-xs font-medium px-3 py-1 rounded-lg bg-navy-500 text-white hover:bg-navy-600"
            >
              Verify identity
            </button>
          )}
        </div>

        {/* Photo */}
        <div className="glass-card mb-6">
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Profile Photo</label>
          <div className="flex items-center gap-4">
            {profile.profilePhoto ? (
              <img src={profile.profilePhoto} alt="Profile" className="w-16 h-16 rounded-full object-cover border border-[var(--border)]" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[var(--background-secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] text-xl">?</div>
            )}
            <div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="px-3 py-1.5 text-sm bg-navy-500 text-white rounded-lg hover:bg-navy-600 disabled:opacity-50 btn-press"
              >
                {uploading ? "Uploading…" : "Upload Photo"}
              </button>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="glass-card mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Full Name *</label>
              <input type="text" value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Bio</label>
              <textarea value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} rows={3} maxLength={500} className={inputCls} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Phone *</label>
                <input type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Date of Birth *</label>
                <input type="date" value={profile.dateOfBirth} onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Nationality *</label>
              <input type="text" value={profile.nationality} onChange={(e) => setProfile({ ...profile, nationality: e.target.value })}
                placeholder="e.g. Germany, France, Spain" className={inputCls} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">ID Type *</label>
                <select value={profile.idType} onChange={(e) => setProfile({ ...profile, idType: e.target.value })} className={inputCls}>
                  <option value="">Select…</option>
                  <option value="national_id">National ID</option>
                  <option value="passport">Passport</option>
                  <option value="residence_permit">Residence Permit</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">ID Number *</label>
                <input type="text" value={profile.idNumber} onChange={(e) => setProfile({ ...profile, idNumber: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Languages spoken</label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((l) => {
                  const checked = profile.languagesSpoken.includes(l.code);
                  return (
                    <label key={l.code} className={`px-3 py-1.5 rounded-full text-xs cursor-pointer border ${checked ? "bg-navy-500 text-white border-navy-500" : "bg-[var(--background-secondary)] text-[var(--text-primary)] border-[var(--border)]"}`}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            languagesSpoken: e.target.checked
                              ? [...profile.languagesSpoken, l.code]
                              : profile.languagesSpoken.filter((x) => x !== l.code),
                          })
                        }
                      />
                      {l.label}
                    </label>
                  );
                })}
              </div>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="w-full px-4 py-2.5 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600 disabled:opacity-50 btn-press">
              {saving ? "Saving…" : "Save Profile"}
            </button>
          </div>
        </div>

        {/* Preferences Section */}
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Preferences</h2>

        {/* Theme */}
        <div className="glass-card mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Theme</p>
              <p className="text-xs text-[var(--text-muted)]">Switch between light and dark mode</p>
            </div>
            <button
              onClick={handleThemeToggle}
              className={`relative w-12 h-7 rounded-full transition-colors btn-press ${darkMode ? "bg-navy-500" : "bg-gray-300 dark:bg-gray-600"}`}
              role="switch"
              aria-checked={darkMode}
              aria-label="Toggle dark mode"
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${darkMode ? "translate-x-5" : ""}`} />
            </button>
          </div>
        </div>

        {/* Language */}
        <div className="glass-card mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Language</p>
              <p className="text-xs text-[var(--text-muted)]">Choose your preferred language</p>
            </div>
            <select
              value={locale}
              onChange={(e) => handleLocaleChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm"
              aria-label="Select language"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Currency */}
        <div className="glass-card mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Currency</p>
              <p className="text-xs text-[var(--text-muted)]">Preferred display currency</p>
            </div>
            <select
              value={prefCurrency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm"
              aria-label="Select currency"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="glass-card mb-6">
          <p className="text-sm font-medium text-[var(--text-primary)] mb-3">Notification Preferences</p>
          <div className="space-y-3">
            {(Object.keys(notifPrefs) as (keyof NotifPrefs)[]).map((key) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-secondary)] capitalize">{key}</span>
                <button
                  onClick={() => handleNotifToggle(key)}
                  className={`relative w-10 h-6 rounded-full transition-colors btn-press ${notifPrefs[key] ? "bg-navy-500" : "bg-gray-300 dark:bg-gray-600"}`}
                  role="switch"
                  aria-checked={notifPrefs[key]}
                  aria-label={`Toggle ${key} notifications`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${notifPrefs[key] ? "translate-x-4" : ""}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
