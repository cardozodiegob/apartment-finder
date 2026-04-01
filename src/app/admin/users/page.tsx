"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/lib/hooks/useToast";
import { ToastContainer } from "@/components/ui/Toast";

interface UserItem {
  _id: string;
  email: string;
  fullName: string;
  role: string;
  trustScore: number;
  isSuspended: boolean;
  idVerified?: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const { toasts, toast, dismissToast } = useToast();

  const fetchUsers = () => {
    fetch(`/api/admin/users?search=${search}`)
      .then((r) => r.json())
      .then((data) => setUsers(data.users || []))
      .catch(() => {});
  };

  useEffect(() => { fetchUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleVerifyToggle(id: string) {
    setActionLoading((prev) => ({ ...prev, [id]: "verify" }));
    try {
      const res = await fetch(`/api/admin/users/${id}/verify-id`, { method: "PUT" });
      if (res.ok) {
        const data = await res.json();
        toast(data.user.idVerified ? "Identity verified" : "Identity unverified", "success");
        fetchUsers();
      } else {
        toast("Failed to update verification", "error");
      }
    } catch {
      toast("Failed to update verification", "error");
    } finally {
      setActionLoading((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
  }

  async function handleSuspendToggle(id: string, isSuspended: boolean) {
    setActionLoading((prev) => ({ ...prev, [id]: "suspend" }));
    try {
      const endpoint = isSuspended ? "reactivate" : "suspend";
      const res = await fetch(`/api/admin/users/${id}/${endpoint}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: `${endpoint} by admin` }),
      });
      if (res.ok) {
        toast(isSuspended ? "User reactivated" : "User suspended", "success");
        fetchUsers();
      } else {
        toast(`Failed to ${endpoint} user`, "error");
      }
    } catch {
      toast("Action failed", "error");
    } finally {
      setActionLoading((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">User Management</h1>
        <div className="flex gap-2 mb-4">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..."
            className="flex-1 px-3 py-2 rounded-lg bg-[var(--background-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm" />
          <button onClick={fetchUsers} className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm btn-press">Search</button>
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
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">ID Verified</th>
                <th className="text-left py-2 px-3 text-[var(--text-secondary)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const currentAction = actionLoading[user._id];
                return (
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
                    <span className={`px-2 py-0.5 rounded-full text-xs ${user.idVerified ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"}`}>
                      {user.idVerified ? "Verified" : "Unverified"}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSuspendToggle(user._id, user.isSuspended)}
                        disabled={!!currentAction}
                        className="text-xs text-navy-500 hover:underline disabled:opacity-50 btn-press"
                      >
                        {currentAction === "suspend" ? "…" : user.isSuspended ? "Reactivate" : "Suspend"}
                      </button>
                      <button
                        onClick={() => handleVerifyToggle(user._id)}
                        disabled={!!currentAction}
                        className={`text-xs hover:underline disabled:opacity-50 btn-press ${user.idVerified ? "text-yellow-600" : "text-green-600"}`}
                      >
                        {currentAction === "verify" ? "…" : user.idVerified ? "Unverify ID" : "Verify ID"}
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
