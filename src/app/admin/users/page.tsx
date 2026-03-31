"use client";

import { useState, useEffect } from "react";

interface UserItem {
  _id: string;
  email: string;
  fullName: string;
  role: string;
  trustScore: number;
  isSuspended: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState("");

  const fetchUsers = () => {
    fetch(`/api/admin/users?adminId=admin&search=${search}`)
      .then((r) => r.json())
      .then((data) => setUsers(data.users || []))
      .catch(() => {});
  };

  useEffect(() => { fetchUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">User Management</h1>
        <div className="flex gap-2 mb-4">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..."
            className="flex-1 px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
          <button onClick={fetchUsers} className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm">Search</button>
        </div>
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Name</th>
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Email</th>
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Role</th>
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Trust</th>
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Status</th>
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className="border-b border-[var(--border)]">
                  <td className="py-2 px-3 text-[var(--text-primary)]">{user.fullName}</td>
                  <td className="py-2 px-3 text-[var(--text-secondary)]">{user.email}</td>
                  <td className="py-2 px-3"><span className="px-2 py-0.5 rounded-full text-xs bg-navy-100 text-navy-700">{user.role}</span></td>
                  <td className="py-2 px-3 text-[var(--text-primary)]">{user.trustScore.toFixed(1)}</td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${user.isSuspended ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      {user.isSuspended ? "Suspended" : "Active"}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <button className="text-xs text-navy-500 hover:underline">
                      {user.isSuspended ? "Reactivate" : "Suspend"}
                    </button>
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
