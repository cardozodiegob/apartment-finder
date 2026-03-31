"use client";

import { useState } from "react";
import Link from "next/link";
import { z } from "zod";

const resetSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type FieldErrors = Partial<Record<"email", string>>;

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setServerError("");

    const parsed = resetSchema.safeParse({ email });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        if (!errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: parsed.data.email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.message || "Failed to send reset link");
        return;
      }
      setSuccess(true);
    } catch {
      setServerError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  if (success) {
    return (
      <div className="glass-card text-center">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
          Check your email
        </h1>
        <p className="text-[var(--text-secondary)] mb-6">
          If an account exists for <strong>{email}</strong>, we sent a password
          reset link. Please check your inbox.
        </p>
        <Link
          href="/login"
          className="text-navy-500 dark:text-navy-300 hover:underline font-medium"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="glass-card">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2 text-center">
        Reset password
      </h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6 text-center">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      {serverError && (
        <div
          className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm"
          role="alert"
        >
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-[var(--text-primary)] mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-navy-500 transition-colors"
            placeholder="you@example.com"
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
          />
          {fieldErrors.email && (
            <p id="email-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 rounded-lg bg-navy-600 hover:bg-navy-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
        Remember your password?{" "}
        <Link
          href="/login"
          className="text-navy-500 dark:text-navy-300 hover:underline font-medium"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
