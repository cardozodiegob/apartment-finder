"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const PROPERTY_TYPES = ["apartment", "room", "house"] as const;
const PURPOSES = ["rent", "share", "sublet"] as const;
const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "BRL"] as const;

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [form, setForm] = useState({
    title: "", description: "",
    propertyType: "apartment" as string, purpose: "rent" as string,
    monthlyRent: 0, currency: "EUR" as string, availableDate: "",
    isSharedAccommodation: false, currentOccupants: 0, availableRooms: 0,
    street: "", city: "", neighborhood: "", postalCode: "", country: "",
    tags: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/listings/${id}`);
        const data = await res.json();
        if (!res.ok) { setServerError("Listing not found"); return; }
        const l = data.listing;
        setForm({
          title: l.title, description: l.description,
          propertyType: l.propertyType, purpose: l.purpose,
          monthlyRent: l.monthlyRent, currency: l.currency,
          availableDate: l.availableDate?.split("T")[0] || "",
          isSharedAccommodation: l.isSharedAccommodation,
          currentOccupants: l.currentOccupants || 0,
          availableRooms: l.availableRooms || 0,
          street: l.address?.street || "", city: l.address?.city || "",
          neighborhood: l.address?.neighborhood || "",
          postalCode: l.address?.postalCode || "", country: l.address?.country || "",
          tags: (l.tags || []).join(", "),
        });
        setLoaded(true);
      } catch { setServerError("Failed to load listing"); }
    }
    if (id) load();
  }, [id]);

  function updateField(field: string, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setServerError("");
    setIsLoading(true);
    try {
      const body = {
        title: form.title, description: form.description,
        propertyType: form.propertyType, purpose: form.purpose,
        monthlyRent: form.monthlyRent, currency: form.currency,
        availableDate: form.availableDate,
        isSharedAccommodation: form.isSharedAccommodation,
        currentOccupants: form.isSharedAccommodation ? form.currentOccupants : undefined,
        availableRooms: form.isSharedAccommodation ? form.availableRooms : undefined,
        address: { street: form.street, city: form.city, neighborhood: form.neighborhood || undefined, postalCode: form.postalCode, country: form.country },
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      const res = await fetch(`/api/listings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setServerError(data.message || "Failed to update"); return; }
      router.push(`/listings/${id}`);
    } catch { setServerError("An unexpected error occurred"); }
    finally { setIsLoading(false); }
  }

  if (!loaded && !serverError) {
    return <div className="min-h-screen bg-[var(--background)] flex items-center justify-center"><p className="text-[var(--text-muted)]">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-[var(--background)] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-8">Edit Listing</h1>
        {serverError && (
          <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm" role="alert">{serverError}</div>
        )}
        <div className="glass-card space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Title</label>
            <input id="title" type="text" value={form.title} onChange={(e) => updateField("title", e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500" />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Description</label>
            <textarea id="description" rows={4} value={form.description} onChange={(e) => updateField("description", e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="propertyType" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Property Type</label>
              <select id="propertyType" value={form.propertyType} onChange={(e) => updateField("propertyType", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500">
                {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="purpose" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Purpose</label>
              <select id="purpose" value={form.purpose} onChange={(e) => updateField("purpose", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500">
                {PURPOSES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="monthlyRent" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Monthly Rent</label>
              <input id="monthlyRent" type="number" min={0} value={form.monthlyRent} onChange={(e) => updateField("monthlyRent", Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500" />
            </div>
            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Currency</label>
              <select id="currency" value={form.currency} onChange={(e) => updateField("currency", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="availableDate" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Available Date</label>
            <input id="availableDate" type="date" value={form.availableDate} onChange={(e) => updateField("availableDate", e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500" />
          </div>
          <div className="flex items-center gap-3">
            <input id="shared" type="checkbox" checked={form.isSharedAccommodation} onChange={(e) => updateField("isSharedAccommodation", e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border)] text-navy-500 focus:ring-navy-500" />
            <label htmlFor="shared" className="text-sm font-medium text-[var(--text-primary)]">Looking for roommates</label>
          </div>
          {form.isSharedAccommodation && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="currentOccupants" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Current Occupants</label>
                <input id="currentOccupants" type="number" min={0} value={form.currentOccupants} onChange={(e) => updateField("currentOccupants", Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500" />
              </div>
              <div>
                <label htmlFor="availableRooms" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Available Rooms</label>
                <input id="availableRooms" type="number" min={0} value={form.availableRooms} onChange={(e) => updateField("availableRooms", Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500" />
              </div>
            </div>
          )}
          <div>
            <label htmlFor="city" className="block text-sm font-medium text-[var(--text-primary)] mb-1">City</label>
            <input id="city" type="text" value={form.city} onChange={(e) => updateField("city", e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500" />
          </div>
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Tags (comma-separated)</label>
            <input id="tags" type="text" value={form.tags} onChange={(e) => updateField("tags", e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500" />
          </div>
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={() => router.back()}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--background-secondary)] transition-colors">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={isLoading}
              className="px-6 py-2 rounded-lg bg-navy-600 hover:bg-navy-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
