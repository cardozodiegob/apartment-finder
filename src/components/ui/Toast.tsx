"use client";

import { useEffect, useState } from "react";

export type ToastVariant = "success" | "error" | "info";

interface ToastProps {
  message: string;
  variant: ToastVariant;
  onDismiss: () => void;
}

const variantStyles: Record<ToastVariant, string> = {
  success: "border-green-400/30 text-green-700 dark:text-green-300",
  error: "border-red-400/30 text-red-700 dark:text-red-300",
  info: "border-blue-400/30 text-blue-700 dark:text-blue-300",
};

const variantIcons: Record<ToastVariant, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
};

export default function Toast({ message, variant, onDismiss }: ToastProps) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 2500);
    const dismissTimer = setTimeout(onDismiss, 3000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-lg backdrop-blur-xl bg-white/70 dark:bg-[#0c1754]/70 ${variantStyles[variant]}`}
      style={{
        animation: fading ? "toast-fade-out 0.5s ease forwards" : "toast-slide-in 0.3s ease",
      }}
      role="alert"
    >
      <span className="text-base font-semibold">{variantIcons[variant]}</span>
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

export function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} variant={t.variant} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}
