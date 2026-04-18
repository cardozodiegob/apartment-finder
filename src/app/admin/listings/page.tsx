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

type ViewMode = "table" | "pipeline";

export default function AdminListingsPage() {
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const { toasts, toast, dismissToast } = useToast();

  const fetchListings = () => {
    setLoading(true);
    const qs = statusFilter ? `?status=${statusFilter}` : "";
    fetch(`/api/admin/listings${qs}`)
      .then((r) => r.json())
      .then((data) => { setListings(data.listings || []); setSelected(new Set()); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchListings(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === listings.length) setSelected(new Set());
    else setSelected(new Set(listings.map((l) => l._id)));
  };

  async function bulkAction(action: "approve" | "archive" | "feature") {
    if (selected.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selected);
    const results = await Promise.allSettled(
      ids.map((id) => {
        if (action === "approve") {
          return fetch(`/api/admin/listings/${id}/approve`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "Bulk approved by admin" }),
          });
        } else if (action === "archive") {
          return fetch(`/api/admin/listings/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "archived", reason: "Bulk archived by admin" }),
          });
        } else {
          return fetch(`/api/admin/listings/${id}/feature`, { method: "POST" });
        }
      })
    );
    const succeeded = results.filter((r) => r.status === "fulfilled" && (r.value as Response).ok).length;
    toast(`${action}: ${succeeded}/${ids.length} succeeded`, succeeded === ids.length ? "success" : "error");
    setBulkLoading(false);
    fetchListings();
  }

  async function handleApprove(id: string) {
    setActionLoading((prev) => ({ ...prev, [id]: "approve" }));
    try {
      const res = await fetch(`/api/admin/listings/${id}/approve`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Approved by admin" }),
      });
      if (res.ok) { toast("Listing approved", "success"); fetchListings(); }
      else toast("Failed to approve listing", "error");
    } catch { toast("Failed to approve listing", "error"); }
    finally { setActionLoading((prev) => { const n = { ...prev }; delete n[id]; return n; }); }
  }

  async function handleRemove(id: string) {
    if (!confirm("Are you sure you want to remove this listing?")) return;
    setActionLoading((prev) => ({ ...prev, [id]: "remove" }));
    try {
      const res = await fetch(`/api/admin/listings/${id}`, { method: "DELETE" });
      if (res.ok) { toast("Listing removed", "success"); fetchListings(); }
      else toast("Failed to remove listing", "error");
    } catch { toast("Failed to remove listing", "error"); }
    finally { setActionLoading((prev) => { const n = { ...prev }; delete n[id]; return n; }); }
  }

  async function handleFeatureToggle(id: string, currentlyFeatured: boolean) {
    setActionLoading((prev) => ({ ...prev, [id]: "feature" }));
    try {
      const res = await fetch(`/api/admin/listings/${id}/feature`, { method: "POST" });
      if (res.ok) { toast(currentlyFeatured ? "Listing unfeatured" : "Listing featured", "success"); fetchListings(); }
      else toast("Failed to update feature status", "error");
    } catch { toast("Failed to update feature status", "error"); }
    finally { setActionLoading((prev) => { const n = { ...prev }; delete n[id]; return n; }); }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    setActionLoading((prev) => ({ ...prev, [id]: "status" }));
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, reason: `Status changed to ${newStatus} by admin` }),
      });
      if (res.ok) { toast(`Status changed to ${newStatus}`, "success"); fetchListings(); }
      else { const data = await res.json().catch(() => ({})); toast(data.message || "Failed to change status", "error"); }
    } catch { toast("Failed to change status", "error"); }
    finally { setActionLoading((prev) => { const n = { ...prev }; delete n[id]; return n; }); }
  }

  const riskBadge = (level?: string) => {
    if (!level) return "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
    if (level === "high") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    if (level === "medium") return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
  };

  const PIPELINE_COLS: { key: string; label: string; color: string }[] = [
    { key: "draft", label: "Draft", color: "border-yellow-400" },
    { key: "under_review", label: "Under Review", color: "border-orange-400" },
    { key: "active", label: "Active", color: "border-green-400" },
    { key: "archived", label: "Archived", color: "border-gray-400" },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Listing Management</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded-lg text-sm btn-press ${viewMode === "table" ? "bg-navy-500 text-white" : "border border-[var(--border)] text-[var(--text-secondary)]"}`}>
              Table
            </button>
            <button onClick={() => setViewMode("pipeline")}
              className={`px-3 py-1.5 rounded-lg text-sm btn-press ${viewMode === "pipeline" ? "bg-navy-500 text-white" : "border border-[var(--border)] text-[var(--text-secondary)]"}`}>
              Pipeline
            </button>
          </div>
        </div>

        {/* Status filter */}
        <div className="flex gap-2 mb-4">
          {["", "active", "under_review", "draft", "archived"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-lg text-sm btn-press ${statusFilter === s ? "bg-navy-500 text-white" : "border border-[var(--border)] text-[var(--text-secondary)]"}`}>
              {s || "All"}
            </button>
          ))}
        </div>

        {/* Bulk Action Bar */}
        {selected.size > 0 && (
          <div className="glass-card flex items-center gap-4 mb-4 py-3">
            <span className="text-sm font-medium text-[var(--text-primary)]">{selected.size} selected</span>
            <button onClick={() => bulkAction("approve")} disabled={bulkLoading}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 btn-press">
              Approve Selected
            </button>
            <button onClick={() => bulkAction("archive")} disabled={bulkLoading}
              className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 btn-press">
              Archive Selected
            </button>
            <button onClick={() => bulkAction("feature")} disabled={bulkLoading}
              className="px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 disabled:opacity-50 btn-press">
              Feature Selected
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-[var(--text-muted)]">Loading listings…</div>
        ) : viewMode === "pipeline" ? (
          /* Pipeline / Kanban View */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {PIPELINE_COLS.map((col) => {
              const colListings = listings.filter((l) => l.status === col.key);
              return (
                <div key={col.key} className={`glass-card border-t-4 ${col.color} p-3`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{col.label}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--background-secondary)] text-[var(--text-muted)]">{colListings.length}</span>
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {colListings.length === 0 && (
                      <p className="text-xs text-[var(--text-muted)] text-center py-4">No listings</p>
                    )}
                    {colListings.map((listing) => (
                      <Link key={listing._id} href={`/listings/${listing._id}`}
                        className="block p-3 rounded-lg bg-[var(--background-secondary)] hover:bg-[var(--surface)] transition-colors border border-[var(--border)]">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{listing.title}</p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-xs text-[var(--text-secondary)]">{listing.currency} {listing.monthlyRent}</span>
                          <span className="text-xs text-[var(--text-muted)]">{listing.address?.city || "—"}</span>
                        </div>
                        {listing.scamRiskLevel && (
                          <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${riskBadge(listing.scamRiskLevel)}`}>
                            {listing.scamRiskLevel} risk
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

        ) : listings.length === 0 ? (
          <div className="glass-card py-12 text-center">
            <p className="text-[var(--text-muted)] text-lg">No listings found</p>
            <p className="text-[var(--text-muted)] text-sm mt-1">Try changing the status filter above</p>
          </div>
        ) : (
          /* Table View */
          <div className="glass-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="py-2 px-3 text-left">
                    <input type="checkbox" checked={selected.size === listings.length && listings.length > 0}
                      onChange={toggleSelectAll} className="w-4 h-4 rounded border-[var(--border)]"
                      aria-label="Select all listings" />
                  </th>
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
                    <td className="py-2 px-3">
                      <input type="checkbox" checked={selected.has(listing._id)}
                        onChange={() => toggleSelect(listing._id)} className="w-4 h-4 rounded border-[var(--border)]"
                        aria-label={`Select ${listing.title}`} />
                    </td>
                    <td className="py-2 px-3 text-[var(--text-primary)]">{listing.title}</td>
                    <td className="py-2 px-3 text-[var(--text-secondary)]">{listing.propertyType}</td>
                    <td className="py-2 px-3 text-[var(--text-primary)]">{listing.currency} {listing.monthlyRent}</td>
                    <td className="py-2 px-3 text-[var(--text-secondary)]">{listing.address?.city || "—"}</td>
                    <td className="py-2 px-3 text-[var(--text-secondary)]">{listing.address?.country || "—"}</td>
                    <td className="py-2 px-3 text-[var(--text-secondary)] text-xs">
                      {typeof listing.posterId === "object" && listing.posterId?.email
                        ? listing.posterId.email : String(listing.posterId || "—")}
                    </td>
                    <td className="py-2 px-3 text-[var(--text-secondary)] text-xs">
                      {listing.createdAt ? new Date(listing.createdAt).toLocaleDateString() : "—"}
                    </td>

                    <td className="py-2 px-3">
                      <select value={listing.status}
                        onChange={(e) => handleStatusChange(listing._id, e.target.value)}
                        disabled={!!currentAction}
                        className={`px-2 py-0.5 rounded-lg text-xs font-medium border-0 cursor-pointer disabled:opacity-50 btn-press ${
                          listing.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                          listing.status === "under_review" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" :
                          listing.status === "draft" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" :
                          "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300"
                        }`}>
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="under_review">Under Review</option>
                        <option value="archived">Archived</option>
                      </select>
                    </td>

                    <td className="py-2 px-3">
                      <select value={listing.scamRiskLevel || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setActionLoading((prev) => ({ ...prev, [listing._id]: "risk" }));
                          fetch(`/api/admin/listings/${listing._id}`, {
                            method: "PUT", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ scamRiskLevel: val || undefined, reason: `Risk level set to ${val || "none"}` }),
                          })
                            .then((r) => { if (r.ok) { toast("Risk updated", "success"); fetchListings(); } else toast("Failed", "error"); })
                            .catch(() => toast("Failed", "error"))
                            .finally(() => setActionLoading((prev) => { const n = { ...prev }; delete n[listing._id]; return n; }));
                        }}
                        disabled={!!currentAction}
                        className={`px-2 py-0.5 rounded-lg text-xs font-medium border-0 cursor-pointer disabled:opacity-50 ${
                          listing.scamRiskLevel === "high" ? "bg-red-100 text-red-700" :
                          listing.scamRiskLevel === "medium" ? "bg-yellow-100 text-yellow-700" :
                          listing.scamRiskLevel === "low" ? "bg-green-100 text-green-700" :
                          "bg-gray-100 text-gray-500"
                        }`}>
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
                          <button onClick={() => handleApprove(listing._id)} disabled={!!currentAction}
                            className="text-xs text-green-600 hover:underline disabled:opacity-50 btn-press">
                            {currentAction === "approve" ? "Approving…" : "Approve"}
                          </button>
                        )}
                        <button onClick={() => handleFeatureToggle(listing._id, !!listing.isFeatured)} disabled={!!currentAction}
                          className={`text-xs hover:underline disabled:opacity-50 btn-press ${listing.isFeatured ? "text-yellow-600" : "text-blue-500"}`}>
                          {currentAction === "feature" ? "Updating…" : listing.isFeatured ? "Unfeature" : "Feature"}
                        </button>
                        <button onClick={() => handleRemove(listing._id)} disabled={!!currentAction}
                          className="text-xs text-red-500 hover:underline disabled:opacity-50 btn-press">
                          {currentAction === "remove" ? "Removing…" : "Remove"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
