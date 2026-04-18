"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ViewingData {
  _id: string;
  listingId: string | { _id: string; title: string };
  seekerId: string | { _id: string; fullName: string };
  posterId: string | { _id: string; fullName: string };
  proposedDate: string;
  status: "pending" | "confirmed" | "declined" | "completed";
  declineReason?: string;
  createdAt: string;
}

export default function ViewingsPage() {
  const router = useRouter();
  const [viewings, setViewings] = useState<ViewingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/viewings")
      .then((r) => {
        if (r.status === 401) { router.push("/login"); return null; }
        return r.json();
      })
      .then((data) => {
        if (data?.viewings) setViewings(data.viewings);
        else if (data?.message) setError(data.message);
      })
      .catch(() => setError("Failed to load viewings"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleConfirm(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/viewings/${id}/confirm`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to confirm"); return; }
      setViewings((prev) => prev.map((v) => (v._id === id ? { ...v, status: "confirmed" } : v)));
    } catch { setError("Failed to confirm viewing"); }
    finally { setActionLoading(null); }
  }

  async function handleDecline(id: string) {
    const reason = prompt("Reason for declining (optional):");
    setActionLoading(id);
    try {
      const res = await fetch(`/api/viewings/${id}/decline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to decline"); return; }
      setViewings((prev) => prev.map((v) => (v._id === id ? { ...v, status: "declined", declineReason: reason || undefined } : v)));
    } catch { setError("Failed to decline viewing"); }
    finally { setActionLoading(null); }
  }

  function getListingTitle(v: ViewingData): string {
    return typeof v.listingId === "object" && v.listingId?.title ? v.listingId.title : "Listing";
  }

  function getPersonName(person: string | { _id: string; fullName: string }): string {
    return typeof person === "object" && person?.fullName ? person.fullName : "User";
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    declined: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    completed: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  };

  const grouped = {
    pending: viewings.filter((v) => v.status === "pending"),
    confirmed: viewings.filter((v) => v.status === "confirmed"),
    declined: viewings.filter((v) => v.status === "declined"),
    completed: viewings.filter((v) => v.status === "completed"),
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Loading viewings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-8">My Viewings</h1>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">{error}</div>
        )}

        {viewings.length === 0 ? (
          <div className="glass-card text-center py-12">
            <div className="text-4xl mb-4">🏠</div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">No viewings yet</h2>
            <p className="text-[var(--text-muted)] mb-4">Request a viewing from a listing page to get started.</p>
            <a href="/search" className="text-navy-500 hover:underline">Browse listings</a>
          </div>
        ) : (
          <div className="space-y-8">
            {(["pending", "confirmed", "declined", "completed"] as const).map((status) => {
              const items = grouped[status];
              if (items.length === 0) return null;
              return (
                <div key={status}>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 capitalize">{status} ({items.length})</h2>
                  <div className="space-y-3">
                    {items.map((v) => (
                      <div key={v._id} className="glass-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">{getListingTitle(v)}</p>
                          <p className="text-sm text-[var(--text-muted)]">
                            Seeker: {getPersonName(v.seekerId)} · Date: {new Date(v.proposedDate).toLocaleDateString()} at {new Date(v.proposedDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          {v.declineReason && (
                            <p className="text-sm text-red-500 mt-1">Reason: {v.declineReason}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[v.status]}`}>
                            {v.status}
                          </span>
                          {v.status === "pending" && (
                            <>
                              <button
                                onClick={() => handleConfirm(v._id)}
                                disabled={actionLoading === v._id}
                                className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 disabled:opacity-50 transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => handleDecline(v._id)}
                                disabled={actionLoading === v._id}
                                className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
                              >
                                Decline
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
