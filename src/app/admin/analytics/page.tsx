"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface AnalyticsData {
  userGrowth: { date: string; count: number }[];
  listingsByStatus: { draft: number; active: number; under_review: number; archived: number };
  listingsByCountry: { country: string; count: number }[];
  recentScamFlags: number;
  totalRevenue: number;
  averageRent: number;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  // Show last 14 days for bar chart
  const last14 = data?.userGrowth?.slice(-14) || [];
  const maxCount = Math.max(...last14.map((d) => d.count), 1);

  const maxCountryCount = Math.max(...(data?.listingsByCountry?.map((c) => c.count) || []), 1);

  const statusColors: Record<string, string> = {
    draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    under_review: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    archived: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] py-8">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-[var(--text-muted)]">Loading analytics…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm">← Back</Link>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Analytics Dashboard</h1>
          </div>
          <button onClick={fetchData} className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600 btn-press">
            Refresh
          </button>
        </div>

        {/* Top metrics row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="glass-card">
            <p className="text-sm text-[var(--text-secondary)]">Total Revenue (Completed)</p>
            <p className="text-3xl font-bold text-[var(--text-primary)] mt-1">{data?.totalRevenue ?? 0}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">completed payments</p>
          </div>
          <div className="glass-card">
            <p className="text-sm text-[var(--text-secondary)]">Average Rent</p>
            <p className="text-3xl font-bold text-[var(--text-primary)] mt-1">€{data?.averageRent?.toLocaleString() ?? 0}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">active listings</p>
          </div>
          <div className="glass-card">
            <p className="text-sm text-[var(--text-secondary)]">Scam Flags</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-3xl font-bold text-[var(--text-primary)]">{data?.recentScamFlags ?? 0}</p>
              {(data?.recentScamFlags ?? 0) > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">⚠ Attention</span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">medium/high risk</p>
          </div>
          <div className="glass-card">
            <p className="text-sm text-[var(--text-secondary)]">New Users (30d)</p>
            <p className="text-3xl font-bold text-[var(--text-primary)] mt-1">{data?.userGrowth?.reduce((s, d) => s + d.count, 0) ?? 0}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">last 30 days</p>
          </div>
        </div>

        {/* User Growth Bar Chart */}
        <div className="glass-card mb-8">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">User Growth (Last 14 Days)</h2>
          <div className="flex items-end gap-1" style={{ height: 160 }}>
            {last14.map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-[var(--text-muted)]">{day.count}</span>
                <div
                  className="w-full rounded-t-md bg-navy-500 transition-all"
                  style={{ height: `${Math.max((day.count / maxCount) * 120, 4)}px` }}
                />
                <span className="text-[10px] text-[var(--text-muted)] rotate-[-45deg] origin-top-left whitespace-nowrap mt-1">
                  {day.date.slice(5)}
                </span>
              </div>
            ))}
            {last14.length === 0 && (
              <p className="text-sm text-[var(--text-muted)] w-full text-center py-8">No data available</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Listings by Status */}
          <div className="glass-card">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Listings by Status</h2>
            <div className="flex flex-wrap gap-3">
              {data?.listingsByStatus && Object.entries(data.listingsByStatus).map(([status, count]) => (
                <div key={status} className={`px-4 py-2 rounded-full text-sm font-medium ${statusColors[status] || "bg-gray-100 text-gray-700"}`}>
                  {status.replace("_", " ")} <span className="font-bold ml-1">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Countries */}
          <div className="glass-card">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Top Countries</h2>
            <div className="space-y-3">
              {data?.listingsByCountry?.map((item) => (
                <div key={item.country} className="flex items-center gap-3">
                  <span className="text-sm text-[var(--text-primary)] w-28 truncate">{item.country}</span>
                  <div className="flex-1 h-6 bg-[var(--background-secondary)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-navy-500 rounded-full transition-all"
                      style={{ width: `${(item.count / maxCountryCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-[var(--text-primary)] w-8 text-right">{item.count}</span>
                </div>
              ))}
              {(!data?.listingsByCountry || data.listingsByCountry.length === 0) && (
                <p className="text-sm text-[var(--text-muted)]">No data available</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
