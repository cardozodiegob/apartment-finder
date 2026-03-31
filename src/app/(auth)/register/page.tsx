"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerSchema } from "@/lib/validations/auth";
import type { z } from "zod";

type FieldErrors = Partial<Record<"email" | "password" | "fullName" | "preferredLanguage", string>>;

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "pt", label: "Português" },
  { value: "it", label: "Italiano" },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setServerError("");

    const parsed = registerSchema.safeParse({ email, password, fullName, preferredLanguage });
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const data = await res.json();
      if (!res.ok) {
        setServerError(data.message || "Registration failed");
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
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Check your email</h1>
        <p className="text-[var(--text-secondary)] mb-6">
          We sent a verification link to <strong>{email}</strong>. Please verify your email to continue.
        </p>
        <Link href="/login" className="text-navy-500 dark:text-navy-300 hover:underline font-medium">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="glass-card">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6 text-center">Create an account</h1>

      {serverError && (
        <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm" role="alert">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-[var(--text-primary)] mb-1">
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-navy-500 transition-colors"
            placeholder="Jane Doe"
            aria-invalid={!!fieldErrors.fullName}
            aria-describedby={fieldErrors.fullName ? "fullName-error" : undefined}
          />
          {fieldErrors.fullName && (
            <p id="fullName-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.fullName}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[var(--text-primary)] mb-1">
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
            <p id="email-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.email}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[var(--text-primary)] mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-navy-500 transition-colors"
            placeholder="At least 8 characters"
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
          />
          {fieldErrors.password && (
            <p id="password-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.password}</p>
          )}
        </div>

        <div>
          <label htmlFor="preferredLanguage" className="block text-sm font-medium text-[var(--text-primary)] mb-1">
            Preferred language
          </label>
          <select
            id="preferredLanguage"
            value={preferredLanguage}
            onChange={(e) => setPreferredLanguage(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-navy-500 transition-colors"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>
          {fieldErrors.preferredLanguage && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.preferredLanguage}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 rounded-lg bg-navy-600 hover:bg-navy-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
        Already have an account?{" "}
        <Link href="/login" className="text-navy-500 dark:text-navy-300 hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
