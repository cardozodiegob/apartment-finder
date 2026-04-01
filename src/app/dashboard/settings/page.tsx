"use client";

import { useState, useEffect, useRef } from "react";
import { useToast } from "@/lib/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";

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
}

const REQUIRED_FIELDS: { key: keyof ProfileData; label: string }[] = [
  { key: "fullName", label: "Full Name" },
  { key: "phone", label: "Phone" },
  { key: "dateOfBirth", label: "Date of Birth" },
  { key: "nationality", label: "Nationality" },
  { key: "idType", label: "ID Type" },
  { key: "idNumber", label: "ID Number" },
];

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileData>({
    _id: "", fullName: "", bio: "", phone: "", dateOfBirth: "",
    nationality: "", idType: "", idNumber: "", profilePhoto: "",
    profileCompleteness: 0, profileCompleted: false, idVerified: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toasts, toast, dismissToast } = useToast();

  useEffect(() => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] py-12">
        <div className="max-w-2xl mx-auto px-4 text-center text-[var(--text-muted)]">Loading…</div>
      </div>
    );
  }

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
          {profile.idVerified && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-2">✓ Identity verified by admin</p>
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
        <div className="glass-card">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Full Name *</label>
              <input type="text" value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Bio</label>
              <textarea value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} rows={3} maxLength={500}
                className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Phone *</label>
                <input type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Date of Birth *</label>
                <input type="date" value={profile.dateOfBirth} onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Nationality *</label>
              <input type="text" value={profile.nationality} onChange={(e) => setProfile({ ...profile, nationality: e.target.value })}
                placeholder="e.g. Germany, France, Spain"
                className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">ID Type *</label>
                <select value={profile.idType} onChange={(e) => setProfile({ ...profile, idType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm">
                  <option value="">Select…</option>
                  <option value="national_id">National ID</option>
                  <option value="passport">Passport</option>
                  <option value="residence_permit">Residence Permit</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">ID Number *</label>
                <input type="text" value={profile.idNumber} onChange={(e) => setProfile({ ...profile, idNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
              </div>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="w-full px-4 py-2.5 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600 disabled:opacity-50 btn-press">
              {saving ? "Saving…" : "Save Profile"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
