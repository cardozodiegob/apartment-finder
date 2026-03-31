"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createListingSchema } from "@/lib/validations/listing";

type Step = "details" | "address" | "photos" | "tags";

const STEPS: Step[] = ["details", "address", "photos", "tags"];

const PROPERTY_TYPES = ["apartment", "room", "house"] as const;
const PURPOSES = ["rent", "share", "sublet"] as const;
const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "BRL"] as const;

export default function NewListingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    propertyType: "apartment" as (typeof PROPERTY_TYPES)[number],
    purpose: "rent" as (typeof PURPOSES)[number],
    monthlyRent: 0,
    currency: "EUR" as (typeof CURRENCIES)[number],
    availableDate: "",
    isSharedAccommodation: false,
    currentOccupants: 0,
    availableRooms: 0,
    street: "",
    city: "",
    neighborhood: "",
    postalCode: "",
    country: "",
    lng: 0,
    lat: 0,
    tags: "",
  });

  function updateField(field: string, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const stepIndex = STEPS.indexOf(step);

  function nextStep() {
    if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1]);
  }

  function prevStep() {
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1]);
  }

  async function handleSubmit() {
    setServerError("");
    setIsLoading(true);

    const data = {
      title: form.title,
      description: form.description,
      propertyType: form.propertyType,
      purpose: form.purpose,
      monthlyRent: form.monthlyRent,
      currency: form.currency,
      availableDate: form.availableDate,
      isSharedAccommodation: form.isSharedAccommodation,
      currentOccupants: form.isSharedAccommodation ? form.currentOccupants : undefined,
      availableRooms: form.isSharedAccommodation ? form.availableRooms : undefined,
      address: {
        street: form.street,
        city: form.city,
        neighborhood: form.neighborhood || undefined,
        postalCode: form.postalCode,
        country: form.country,
      },
      location: { type: "Point" as const, coordinates: [form.lng, form.lat] as [number, number] },
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };

    const parsed = createListingSchema.safeParse(data);
    if (!parsed.success) {
      setServerError(parsed.error.errors[0].message);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        setServerError(result.message || "Failed to create listing");
        setIsLoading(false);
        return;
      }

      // Upload photos if any
      if (photos.length > 0 && result.listing?._id) {
        const formData = new FormData();
        photos.forEach((p) => formData.append("photos", p));
        await fetch(`/api/listings/${result.listing._id}/photos`, {
          method: "POST",
          body: formData,
        });
      }

      router.push(`/listings/${result.listing._id}`);
    } catch {
      setServerError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-8">
          Create New Listing
        </h1>

        {/* Step indicator */}
        <div className="flex gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full transition-colors ${
                i <= stepIndex ? "bg-navy-500" : "bg-[var(--border)]"
              }`}
            />
          ))}
        </div>

        {serverError && (
          <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm" role="alert">
            {serverError}
          </div>
        )}

        <div className="glass-card">
          {/* Step: Details */}
          {step === "details" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Listing Details</h2>
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Title</label>
                <input id="title" type="text" value={form.title} onChange={(e) => updateField("title", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500"
                  placeholder="Cozy apartment in city center" />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Description</label>
                <textarea id="description" rows={4} value={form.description} onChange={(e) => updateField("description", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500"
                  placeholder="Describe your property..." />
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
              {/* Shared accommodation toggle */}
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
            </div>
          )}

          {/* Step: Address */}
          {step === "address" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Address & Location</h2>
              <div>
                <label htmlFor="street" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Street</label>
                <input id="street" type="text" value={form.street} onChange={(e) => updateField("street", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500"
                  placeholder="123 Main Street" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-[var(--text-primary)] mb-1">City</label>
                  <input id="city" type="text" value={form.city} onChange={(e) => updateField("city", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500"
                    placeholder="Berlin" />
                </div>
                <div>
                  <label htmlFor="neighborhood" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Neighborhood (optional)</label>
                  <input id="neighborhood" type="text" value={form.neighborhood} onChange={(e) => updateField("neighborhood", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500"
                    placeholder="Mitte" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="postalCode" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Postal Code</label>
                  <input id="postalCode" type="text" value={form.postalCode} onChange={(e) => updateField("postalCode", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500"
                    placeholder="10115" />
                </div>
                <div>
                  <label htmlFor="country" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Country</label>
                  <input id="country" type="text" value={form.country} onChange={(e) => updateField("country", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500"
                    placeholder="Germany" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="lng" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Longitude</label>
                  <input id="lng" type="number" step="any" value={form.lng} onChange={(e) => updateField("lng", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500" />
                </div>
                <div>
                  <label htmlFor="lat" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Latitude</label>
                  <input id="lat" type="number" step="any" value={form.lat} onChange={(e) => updateField("lat", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500" />
                </div>
              </div>
              <p className="text-xs text-[var(--text-muted)]">Map pin placement will be available in a future update.</p>
            </div>
          )}

          {/* Step: Photos */}
          {step === "photos" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Photos</h2>
              <div className="border-2 border-dashed border-[var(--border)] rounded-lg p-8 text-center">
                <input
                  id="photos"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setPhotos(Array.from(e.target.files || []))}
                  className="hidden"
                />
                <label htmlFor="photos" className="cursor-pointer">
                  <div className="text-[var(--text-muted)] mb-2">
                    <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-8m0 0l-3 3m3-3l3 3M3 16.5V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18v-1.5M3 16.5l4.72-4.72a2.25 2.25 0 013.18 0l4.72 4.72M21 16.5l-2.47-2.47a2.25 2.25 0 00-3.18 0L12 17.25" />
                    </svg>
                  </div>
                  <p className="text-sm text-[var(--text-primary)]">Click to upload photos</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">JPEG, PNG, or WebP — max 5MB each</p>
                </label>
              </div>
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((p, i) => (
                    <div key={i} className="relative aspect-video rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center overflow-hidden">
                      <img src={URL.createObjectURL(p)} alt={`Preview ${i + 1}`} className="object-cover w-full h-full" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: Tags */}
          {step === "tags" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Tags & Review</h2>
              <div>
                <label htmlFor="tags" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Tags (comma-separated)</label>
                <input id="tags" type="text" value={form.tags} onChange={(e) => updateField("tags", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500"
                  placeholder="furnished, pet-friendly, balcony" />
              </div>
              <div className="glass-card mt-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Summary</h3>
                <p className="text-sm text-[var(--text-secondary)]">{form.title || "Untitled"} — {form.propertyType} for {form.purpose}</p>
                <p className="text-sm text-[var(--text-secondary)]">{form.monthlyRent} {form.currency}/month</p>
                <p className="text-sm text-[var(--text-secondary)]">{form.city}, {form.country}</p>
                {form.isSharedAccommodation && (
                  <p className="text-sm text-[var(--text-muted)]">Shared: {form.currentOccupants} occupants, {form.availableRooms} rooms available</p>
                )}
                <p className="text-sm text-[var(--text-muted)]">{photos.length} photo(s)</p>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-6">
            <button
              type="button"
              onClick={prevStep}
              disabled={stepIndex === 0}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--background-secondary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Back
            </button>
            {stepIndex < STEPS.length - 1 ? (
              <button type="button" onClick={nextStep}
                className="px-6 py-2 rounded-lg bg-navy-600 hover:bg-navy-700 text-white font-medium transition-colors">
                Next
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={isLoading}
                className="px-6 py-2 rounded-lg bg-navy-600 hover:bg-navy-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {isLoading ? "Creating…" : "Create Listing"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
