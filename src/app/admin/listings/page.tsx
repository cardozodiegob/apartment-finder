"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useToast } from "@/lib/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";

interface ListingItem {
  _id: string;
  title: string;
  status: string;
  propertyType: string;
  monthlyRent: number;
  currency: string;
  scamRiskLevel?: string;
  isFeatured?: boolean;
  address?: { city?: string; country?: string };
  posterId?: string | { email?: string };
  createdAt?: string;
}

export default function AdminListingsPage() {
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const { toasts, toast, dismissToast } = useToast();

  const fetchListings = () => {
    setLoading(true);
    const qs = statusFilter ? `?status=${statusFilter}` : "";
    fetch(`/api/admin/listings${qs}`)
      .then((r) => r.json())
      .then((data) => setListings(data.listings || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchListings();
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleApprove(id: string) {
    setActionLoading((prev) => ({ ...prev, [id]: "approve" }));
    try {
      const res = await fetch(`/api/admin/listings/${id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Approved by admin" }),
      });
      if (res.ok) {
        toast("Listing approved", "success");
        fetchListings();
      } else {
        toast("Failed to approve listing", "error");
      }
    } catch {
      toast("Failed to approve listing", "error");
    } finally {
      setActionLoading((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
  }

  async function handleRemove(id: string) {
    if (!confirm("Are you sure you want to remove this listing?")) return;
    setActionLoading((prev) => ({ ...prev, [id]: "remove" }));
    try {
      const res = await fetch(`/api/admin/listings/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Listing removed", "success");
        fetchListings();
      } else {
        toast("Failed to remove listing", "error");
      }
    } catch {
      toast("Failed to remove listing", "error");
    } finally {
      setActionLoading((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
  }

  async function handleFeatureToggle(id: string, currentlyFeatured: boolean) {
    setActionLoading((prev) => ({ ...prev, [id]: "feature" }));
    try {
      const res = await fetch(`/api/admin/listings/${id}/feature`, { method: "POST" });
      if (res.ok) {
        toast(currentlyFeatured ? "Listing unfeatured" : "Listing featured", "success");
        fetchListings();
      } else {
        toast("Failed to update feature status", "error");
      }
    } catch {
      toast("Failed to update feature status", "error");
    } finally {
      setActionLoading((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    setActionLoading((prev) => ({ ...prev, [id]: "status" }));
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, reason: `Status changed to ${newStatus} by admin` }),
      });
      if (res.ok) {
        toast(`Status changed to ${newStatus}`, "success");
        fetchListings();
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data.message || "Failed to change status", "error");
      }
    } catch {
      toast("Failed to change status", "error");
    } finally {
      setActionLoading((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Listing Management</h1>
        <div className="flex gap-2 mb-4">
          {["", "active", "under_review", "draft", "archived"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-lg text-sm btn-press ${statusFilter === s ? "bg-navy-500 text-white" : "border border-[var(--border)] text-[var(--text-secondary)]"}`}>
              {s || "All"}
            </button>
          ))}
        </div>
        <div className="glass-card overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-[var(--text-muted)]">Loading listings…</div>
          ) : listings.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[var(--text-muted)] text-lg">No listings found</p>
              <p className="text-[var(--text-muted)] text-sm mt-1">Try changing the status filter above</p>
            </div>
          ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Title</th>
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Type</th>
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Price</th>
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">City</th>
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Country</th>
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Poster</th>
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Created</th>
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Status</th>
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Risk</th>
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => {
                const currentAction = actionLoading[listing._id];
                return (
                <tr key={listing._id} className="border-b border-[var(--border)]">
                  <td className="py-2 px-3 text-[var(--text-primary)]">{listing.title}</td>
                  <td className="py-2 px-3 text-[var(--text-secondary)]">{listing.propertyType}</td>
                  <td className="py-2 px-3 text-[var(--text-primary)]">{listing.currency} {listing.monthlyRent}</td>
                  <td className="py-2 px-3 text-[var(--text-secondary)]">{listing.address?.city || "—"}</td>
                  <td className="py-2 px-3 text-[var(--text-secondary)]">{listing.address?.country || "—"}</td>
                  <td className="py-2 px-3 text-[var(--text-secondary)] text-xs">
                    {typeof listing.posterId === "object" && listing.posterId?.email
                      ? listing.posterId.email
                      : String(listing.posterId || "—")}
                  </td>
                  <td className="py-2 px-3 text-[var(--text-secondary)] text-xs">
                    {listing.createdAt ? new Date(listing.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={listing.status}
                      onChange={(e) => handleStatusChange(listing._id, e.target.value)}
                      disabled={!!currentAction}
                      className={`px-2 py-0.5 rounded-lg text-xs font-medium border-0 cursor-pointer disabled:opacity-50 btn-press ${
                        listing.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                        listing.status === "under_review" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" :
                        listing.status === "draft" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" :
                        "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300"
                      }`}
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="under_review">Under Review</option>
                      <option value="archived">Archived</option>
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={listing.scamRiskLevel || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActionLoading((prev) => ({ ...prev, [listing._id]: "risk" }));
                        fetch(`/api/admin/listings/${listing._id}`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ scamRiskLevel: val || undefined, reason: `Risk level set to ${val || "none"}` }),
                        })
                          .then((r) => { if (r.ok) { toast(`Risk updated`, "success"); fetchListings(); } else toast("Failed", "error"); })
                          .catch(() => toast("Failed", "error"))
                          .finally(() => setActionLoading((prev) => { const n = { ...prev }; delete n[listing._id]; return n; }));
                      }}
                      disabled={!!currentAction}
                      className={`px-2 py-0.5 rounded-lg text-xs font-medium border-0 cursor-pointer disabled:opacity-50 ${
                        listing.scamRiskLevel === "high" ? "bg-red-100 text-red-700" :
                        listing.scamRiskLevel === "medium" ? "bg-yellow-100 text-yellow-700" :
                        listing.scamRiskLevel === "low" ? "bg-green-100 text-green-700" :
                        "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <option value="">—</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex gap-2 flex-wrap">
                      <Link href={`/listings/${listing._id}`} className="text-xs text-navy-500 hover:underline btn-press">View</Link>
                      {listing.status === "under_review" && (
                        <button
                          onClick={() => handleApprove(listing._id)}
                          disabled={!!currentAction}
                          className="text-xs text-green-600 hover:underline disabled:opacity-50 btn-press"
                        >
                          {currentAction === "approve" ? "Approving…" : "Approve"}
                        </button>
                      )}
                      <button
                        onClick={() => handleFeatureToggle(listing._id, !!listing.isFeatured)}
                        disabled={!!currentAction}
                        className={`text-xs hover:underline disabled:opacity-50 btn-press ${listing.isFeatured ? "text-yellow-600" : "text-blue-500"}`}
                      >
                        {currentAction === "feature" ? "Updating…" : listing.isFeatured ? "Unfeature" : "Feature"}
                      </button>
                      <button
                        onClick={() => handleRemove(listing._id)}
                        disabled={!!currentAction}
                        className="text-xs text-red-500 hover:underline disabled:opacity-50 btn-press"
                      >
                        {currentAction === "remove" ? "Removing…" : "Remove"}
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </div>
      </div>
    </div>
  );
}
