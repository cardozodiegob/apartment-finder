"use client";

import { useState, useEffect } from "react";

interface ListingItem {
  _id: string;
  title: string;
  status: string;
  propertyType: string;
  monthlyRent: number;
  currency: string;
  scamRiskLevel?: string;
}

export default function AdminListingsPage() {
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const qs = statusFilter ? `&status=${statusFilter}` : "";
    fetch(`/api/admin/listings?adminId=admin${qs}`)
      .then((r) => r.json())
      .then((data) => setListings(data.listings || []))
      .catch(() => {});
  }, [statusFilter]);

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Listing Management</h1>
        <div className="flex gap-2 mb-4">
          {["", "active", "under_review", "draft", "archived"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-lg text-sm ${statusFilter === s ? "bg-navy-500 text-white" : "border border-[var(--border)] text-[var(--text-secondary)]"}`}>
              {s || "All"}
            </button>
          ))}
        </div>
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Title</th>
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Type</th>
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Price</th>
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Status</th>
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Risk</th>
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => (
                <tr key={listing._id} className="border-b border-[var(--border)]">
                  <td className="py-2 px-3 text-[var(--text-primary)]">{listing.title}</td>
                  <td className="py-2 px-3 text-[var(--text-secondary)]">{listing.propertyType}</td>
                  <td className="py-2 px-3 text-[var(--text-primary)]">{listing.currency} {listing.monthlyRent}</td>
                  <td className="py-2 px-3"><span className="px-2 py-0.5 rounded-full text-xs bg-navy-100 text-navy-700">{listing.status}</span></td>
                  <td className="py-2 px-3">{listing.scamRiskLevel || "—"}</td>
                  <td className="py-2 px-3 flex gap-2">
                    {listing.status === "under_review" && <button className="text-xs text-green-600 hover:underline">Approve</button>}
                    <button className="text-xs text-red-500 hover:underline">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
