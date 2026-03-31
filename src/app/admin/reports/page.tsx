"use client";

import { useState, useEffect } from "react";

interface ReportItem {
  _id: string;
  category: string;
  description: string;
  status: string;
  createdAt: string;
  reportedUserId?: string;
  reportedListingId?: string;
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);

  useEffect(() => {
    fetch("/api/admin/reports?adminId=admin")
      .then((r) => r.json())
      .then((data) => setReports(data.reports || []))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Report Queue</h1>
        <p className="text-sm text-[var(--text-muted)] mb-4">Sorted by oldest unresolved first</p>
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report._id} className="glass-card">
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 mr-2">{report.category.replace(/_/g, " ")}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">{report.status}</span>
                  <p className="text-sm text-[var(--text-primary)] mt-2">{report.description}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{new Date(report.createdAt).toLocaleString()}</p>
                </div>
                <button className="px-3 py-1 bg-navy-500 text-white rounded-lg text-xs hover:bg-navy-600">Resolve</button>
              </div>
            </div>
          ))}
          {reports.length === 0 && <p className="text-[var(--text-muted)] text-sm">No pending reports</p>}
        </div>
      </div>
    </div>
  );
}
