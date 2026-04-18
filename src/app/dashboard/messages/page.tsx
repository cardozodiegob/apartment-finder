"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface ThreadData {
  _id: string;
  listingId: string | { _id: string; title: string };
  participants: string[];
  lastMessageAt: string;
  readBy?: Record<string, string>;
}

interface MessageData {
  _id: string;
  threadId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export default function MessagesPage() {
  const router = useRouter();
  const [threads, setThreads] = useState<ThreadData[]>([]);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<Record<string, boolean>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch session to get current user id
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => {
        if (r.status === 401) { router.push("/login"); return null; }
        return r.json();
      })
      .then((data) => {
        if (data?.user?.mongoId) setCurrentUserId(data.user.mongoId);
        else if (data?.user?.id) setCurrentUserId(data.user.id);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  // Fetch threads
  useEffect(() => {
    fetch("/api/messages/threads")
      .then((r) => {
        if (r.status === 401) { router.push("/login"); return null; }
        return r.json();
      })
      .then((data) => {
        if (data?.threads) setThreads(data.threads);
        else if (data?.message) setError(data.message);
      })
      .catch(() => setError("Failed to load threads"))
      .finally(() => setLoading(false));
  }, [router]);

  // Fetch messages when thread selected
  useEffect(() => {
    if (!selectedThread) return;
    setMessages([]);
    fetch(`/api/messages/threads/${selectedThread}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.messages) setMessages(data.messages);
      })
      .catch(() => setError("Failed to load messages"));
  }, [selectedThread]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function isUnread(thread: ThreadData): boolean {
    if (!currentUserId || !thread.readBy) return false;
    const lastRead = thread.readBy[currentUserId];
    if (!lastRead) return true;
    return new Date(thread.lastMessageAt) > new Date(lastRead);
  }

  function getOtherParticipant(thread: ThreadData): string {
    if (!currentUserId) return "Participant";
    const other = thread.participants.find((p) => p !== currentUserId);
    return other || "Participant";
  }

  function getListingTitle(thread: ThreadData): string {
    if (typeof thread.listingId === "object" && thread.listingId?.title) {
      return thread.listingId.title;
    }
    return "Listing";
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedThread) return;

    const thread = threads.find((t) => t._id === selectedThread);
    if (!thread) return;

    const listingId = typeof thread.listingId === "object" ? thread.listingId._id : thread.listingId;

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, body: newMessage.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to send message");
        return;
      }
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
        setNewMessage("");
        // Update thread lastMessageAt
        setThreads((prev) =>
          prev.map((t) =>
            t._id === selectedThread
              ? { ...t, lastMessageAt: new Date().toISOString() }
              : t
          )
        );
      }
    } catch {
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Loading messages...</p>
      </div>
    );
  }

  // Empty state
  if (threads.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--background)] py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-8">Messages</h1>
          <div className="glass-card text-center py-12">
            <svg className="w-12 h-12 mx-auto text-[var(--text-muted)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8-1.64 0-3.182-.39-4.51-1.08L3 21l1.25-4.32C3.45 15.52 3 14.3 3 13c0-4.418 4.03-8 9-8s9 3.582 9 7z" />
            </svg>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">No messages yet</h2>
            <p className="text-[var(--text-muted)] mb-4">
              Start a conversation by contacting a poster from a listing page.
            </p>
            <a href="/search" className="text-navy-500 hover:underline">Browse listings</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-6">Messages</h1>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ minHeight: "60vh" }}>
          {/* Thread List (left panel) */}
          <div className="glass-card md:col-span-1 overflow-y-auto" style={{ maxHeight: "70vh" }}>
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
              Conversations
            </h2>
            <div className="space-y-1">
              {threads
                .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
                .map((thread) => (
                  <button
                    key={thread._id}
                    onClick={() => setSelectedThread(thread._id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedThread === thread._id
                        ? "bg-navy-100 dark:bg-navy-900/30"
                        : "hover:bg-[var(--background-secondary)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {getListingTitle(thread)}
                      </p>
                      {isUnread(thread) && (
                        <span className="w-2.5 h-2.5 rounded-full bg-navy-500 flex-shrink-0 ml-2" />
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                      {getOtherParticipant(thread)}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {new Date(thread.lastMessageAt).toLocaleDateString()}
                    </p>
                  </button>
                ))}
            </div>
          </div>

          {/* Message View (right panel) */}
          <div className="glass-card md:col-span-2 flex flex-col" style={{ maxHeight: "70vh" }}>
            {!selectedThread ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[var(--text-muted)]">Select a conversation to view messages</p>
              </div>
            ) : (
              <>
                {/* Thread header */}
                {(() => {
                  const thread = threads.find((t) => t._id === selectedThread);
                  if (!thread) return null;
                  return (
                    <div className="pb-3 mb-3 border-b border-[var(--border)]">
                      <p className="font-semibold text-[var(--text-primary)]">{getListingTitle(thread)}</p>
                      <p className="text-xs text-[var(--text-muted)]">with {getOtherParticipant(thread)}</p>
                    </div>
                  );
                })()}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto space-y-3 mb-3">
                  {messages.length === 0 ? (
                    <p className="text-[var(--text-muted)] text-center py-8">No messages in this thread yet</p>
                  ) : (
                    messages.map((msg) => {
                      const isOwn = msg.senderId === currentUserId;
                      const translated = translations[msg._id];

                      async function translate() {
                        const targetLanguage = (typeof navigator !== "undefined" && navigator.language) || "en";
                        const lang = targetLanguage.split("-")[0];
                        setTranslating((t) => ({ ...t, [msg._id]: true }));
                        try {
                          const res = await fetch("/api/messages/translate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ messageId: msg._id, targetLanguage: lang }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            setTranslations((tr) => ({ ...tr, [msg._id]: data.translatedBody }));
                          }
                        } finally {
                          setTranslating((t) => ({ ...t, [msg._id]: false }));
                        }
                      }

                      async function flagScam() {
                        await fetch("/api/reports", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            targetType: "message",
                            targetId: msg._id,
                            reason: "Potential scam reported from messaging UI",
                          }),
                        });
                        setFlagged((f) => ({ ...f, [msg._id]: true }));
                      }

                      return (
                        <div key={msg._id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${
                              isOwn
                                ? "bg-navy-500 text-white"
                                : "bg-[var(--background-secondary)] text-[var(--text-primary)]"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.body}</p>
                            {translated && (
                              <p className={`text-xs mt-1 italic ${isOwn ? "text-white/80" : "text-[var(--text-secondary)]"}`}>
                                {translated}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <p className={`text-xs ${isOwn ? "text-white/70" : "text-[var(--text-muted)]"}`}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                              {!isOwn && (
                                <>
                                  <button
                                    type="button"
                                    onClick={translate}
                                    disabled={translating[msg._id]}
                                    className="text-xs underline text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50"
                                  >
                                    {translating[msg._id] ? "…" : translated ? "Re-translate" : "Translate"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={flagScam}
                                    disabled={!!flagged[msg._id]}
                                    className="text-xs underline text-red-400 hover:text-red-500 disabled:opacity-50"
                                  >
                                    {flagged[msg._id] ? "Reported" : "Mark as scam"}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Send form */}
                <form onSubmit={handleSend} className="flex gap-2 pt-3 border-t border-[var(--border)]">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!sending && newMessage.trim()) handleSend(e as unknown as React.FormEvent);
                      }
                    }}
                    placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                    rows={1}
                    className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 resize-none"
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className="px-4 py-2 rounded-lg bg-navy-500 text-white text-sm font-medium hover:bg-navy-600 disabled:opacity-50 transition-colors"
                  >
                    {sending ? "Sending..." : "Send"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
