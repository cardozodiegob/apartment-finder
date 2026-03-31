"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface PaymentData {
  payment: {
    _id: string;
    amount: number;
    currency: string;
    status: string;
    seekerConfirmedAt?: string;
    posterConfirmedAt?: string;
    escrowExpiresAt: string;
    receiptUrl?: string;
    disputeReason?: string;
  };
  displayAmount: string;
  convertedAmount?: string;
}

export default function PaymentPage() {
  const params = useParams();
  const [data, setData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/payments/${params.id}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[var(--text-muted)]">Loading...</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-red-500">Payment not found</div>;

  const { payment, displayAmount, convertedAmount } = data;
  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    seeker_confirmed: "bg-blue-100 text-blue-800",
    poster_confirmed: "bg-blue-100 text-blue-800",
    both_confirmed: "bg-green-100 text-green-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-gray-100 text-gray-800",
    disputed: "bg-red-100 text-red-800",
  };

  return (
    <div className="min-h-screen bg-[var(--background)] py-8">
      <div className="max-w-lg mx-auto px-4">
        <div className="glass-card">
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Payment Details</h1>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Amount</span>
              <div className="text-right">
                <span className="font-semibold text-[var(--text-primary)]">{displayAmount}</span>
                {convertedAmount && <span className="block text-sm text-[var(--text-muted)]">≈ {convertedAmount}</span>}
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Status</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[payment.status] || ""}`}>
                {payment.status.replace(/_/g, " ")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Escrow Expires</span>
              <span className="text-[var(--text-primary)]">{new Date(payment.escrowExpiresAt).toLocaleString()}</span>
            </div>
            {payment.seekerConfirmedAt && (
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Seeker Confirmed</span>
                <span className="text-green-600">✓ {new Date(payment.seekerConfirmedAt).toLocaleString()}</span>
              </div>
            )}
            {payment.posterConfirmedAt && (
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Poster Confirmed</span>
                <span className="text-green-600">✓ {new Date(payment.posterConfirmedAt).toLocaleString()}</span>
              </div>
            )}
            {payment.disputeReason && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300">Dispute: {payment.disputeReason}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
