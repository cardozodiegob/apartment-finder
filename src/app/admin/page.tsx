"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface DashboardMetrics {
  totalUsers: number;
  activeListings: number;
  pendingReports: number;
  recentPayments: number;
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    // In production, adminId comes from session
    fetch("/api/admin/dashboard?adminId=admin")
      .then((r) => r.json())
      .then(setMetrics)
      .catch(() => {});
  }, []);

  const cards = [
    { label: "Total Users", value: metrics?.totalUsers ?? "—", href: "/admin/users", color: "bg-blue-500" },
    { label: "Active Listings", value: metrics?.activeListings ?? "—", href: "/admin/listings", color: "bg-green-500" },
    { label: "Pending Reports", value: metrics?.pendingReports ?? "—", href: "/admin/reports", color: "bg-red-500" },
    { label: "Recent Payments", value: metrics?.recentPayments ?? "—", href: "#", color: "bg-purple-500" },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Admin Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {cards.map((card) => (
            <Link key={card.label} href={card.href} className="glass-card hover:scale-[1.02] transition-transform">
              <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center text-white text-lg mb-3`}>
                {String(card.value).charAt(0)}
              </div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{card.value}</p>
              <p className="text-sm text-[var(--text-secondary)]">{card.label}</p>
            </Link>
          ))}
        </div>
        <div className="flex gap-4 flex-wrap">
          <Link href="/admin/users" className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600">Manage Users</Link>
          <Link href="/admin/listings" className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600">Manage Listings</Link>
          <Link href="/admin/reports" className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600">Report Queue</Link>
        </div>
      </div>
    </div>
  );
}
