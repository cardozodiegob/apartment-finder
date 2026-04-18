"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface DocumentData {
  _id: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  proof_of_income: "Proof of Income",
  employment_letter: "Employment Letter",
  reference_letter: "Reference Letter",
  identity_document: "Identity Document",
  bank_statement: "Bank Statement",
};

const DOC_TYPES = Object.keys(DOC_TYPE_LABELS);

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState(DOC_TYPES[0]);
  const [successMsg, setSuccessMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => {
        if (r.status === 401) { router.push("/login"); return null; }
        return r.json();
      })
      .then((data) => {
        if (data?.documents) setDocuments(data.documents);
        else if (data?.message) setError(data.message);
      })
      .catch(() => setError("Failed to load documents"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) { setError("Please select a file"); return; }

    // Client-side validation
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      setError("Only PDF, JPG, and PNG files are accepted");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File size must not exceed 10MB");
      return;
    }

    setUploading(true);
    setError("");
    setSuccessMsg("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", selectedType);

    try {
      const res = await fetch("/api/documents", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Upload failed");
        return;
      }
      if (data.document) {
        setDocuments((prev) => [data.document, ...prev]);
        setSuccessMsg("Document uploaded successfully");
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to delete");
        return;
      }
      setDocuments((prev) => prev.filter((d) => d._id !== docId));
      setSuccessMsg("Document deleted");
    } catch {
      setError("Failed to delete document");
    }
  }

  async function handleShare(docId: string) {
    try {
      const res = await fetch(`/api/documents/${docId}/share`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to generate share link"); return; }
      await navigator.clipboard.writeText(data.url);
      setSuccessMsg("Share link copied to clipboard (valid for 7 days)");
    } catch {
      setError("Failed to generate share link");
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Loading documents...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-8">My Documents</h1>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">{error}</div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm">{successMsg}</div>
        )}

        {/* Upload form */}
        <div className="glass-card mb-8">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Upload Document</h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Document Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--text-primary)] text-sm"
              >
                {DOC_TYPES.map((type) => (
                  <option key={type} value={type}>{DOC_TYPE_LABELS[type]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">File (PDF, JPG, PNG — max 10MB)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="w-full text-sm text-[var(--text-primary)]"
              />
            </div>
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 rounded-lg bg-navy-500 text-white text-sm font-medium hover:bg-navy-600 disabled:opacity-50 transition-colors"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </form>
        </div>

        {/* Document list */}
        {documents.length === 0 ? (
          <div className="glass-card text-center py-12">
            <div className="text-4xl mb-4">📄</div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">No documents yet</h2>
            <p className="text-[var(--text-muted)]">Upload your first document above to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div key={doc._id} className="glass-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{doc.fileName}</p>
                  <p className="text-sm text-[var(--text-muted)]">
                    {DOC_TYPE_LABELS[doc.documentType] || doc.documentType} · {formatFileSize(doc.fileSize)} · {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleShare(doc._id)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-primary)] hover:bg-[var(--background-secondary)] transition-colors"
                  >
                    Share
                  </button>
                  <button
                    onClick={() => handleDelete(doc._id)}
                    className="px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
