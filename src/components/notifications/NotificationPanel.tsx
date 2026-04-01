"use client";

import { useState, useEffect } from "react";
import { BellIcon, ShieldIcon, StarIcon } from "@/components/icons";

function NotificationTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "scam_alert":
    case "report":
      return <ShieldIcon size={16} className="text-red-500 shrink-0" />;
    case "review":
    case "trust":
      return <StarIcon size={16} className="text-yellow-500 shrink-0" />;
    default:
      return <BellIcon size={16} className="text-navy-500 shrink-0" />;
  }
}

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationPanel({ userId, isOpen, onClose }: { userId: string; isOpen: boolean; onClose: () => void }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (isOpen && userId) {
      fetch(`/api/notifications?userId=${userId}`)
        .then((r) => r.json())
        .then((data) => setNotifications(data.notifications || []))
        .catch(() => {});
    }
  }, [isOpen, userId]);

  const handleMarkRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n));
  };

  const handleDismiss = async (id: string) => {
    await fetch(`/api/notifications/${id}/dismiss`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setNotifications((prev) => prev.filter((n) => n._id !== id));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-80 z-50 glass-lg shadow-2xl p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Notifications</h2>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
      </div>
      {notifications.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No notifications</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n._id} className={`p-3 rounded-lg border border-[var(--border)] ${n.isRead ? "opacity-60" : "bg-[var(--background-secondary)]"}`}>
              <div className="flex items-start justify-between">
                <div className="flex gap-2 flex-1">
                  <NotificationTypeIcon type={n.type} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{n.title}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{n.body}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
                  {!n.isRead && (
                    <button onClick={() => handleMarkRead(n._id)} className="text-xs text-navy-500 hover:underline">Read</button>
                  )}
                  <button onClick={() => handleDismiss(n._id)} className="text-xs text-red-500 hover:underline">✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
