"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (next: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Single source of truth for the theme storage key.
 * MUST match the key used inside `ThemeBootstrap.tsx`.
 */
export const THEME_STORAGE_KEY = "theme";

/**
 * Pure resolver — given a stored preference and the system preference,
 * returns the concrete ("light" | "dark") theme to apply.
 *
 * Exported so property-based tests can validate determinism (Property 1).
 */
export function resolveTheme(
  stored: Theme | null | undefined,
  prefersDark: boolean,
): ResolvedTheme {
  if (stored === "light" || stored === "dark") return stored;
  return prefersDark ? "dark" : "light";
}

/**
 * Pure next-theme helper — given the current stored preference and the
 * system preference, returns the next preference when the user toggles.
 * Toggle cycles light → dark → light (ignoring "system" until explicitly set).
 */
export function nextTheme(
  stored: Theme | null | undefined,
  prefersDark: boolean,
): Theme {
  const resolved = resolveTheme(stored, prefersDark);
  return resolved === "dark" ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // On first render (client), read the stored value + media query.
  // SSR-safe default: "system" — real value is applied in the effect.
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  // Hydrate from localStorage + prefers-color-scheme on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    const prefersDark =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const initialTheme: Theme =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";
    setThemeState(initialTheme);
    setResolvedTheme(resolveTheme(initialTheme === "system" ? null : initialTheme, prefersDark));
  }, []);

  // React to system preference changes while theme === "system"
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") {
        setResolvedTheme(mql.matches ? "dark" : "light");
      }
    };
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, [theme]);

  // Apply the resolved theme to <html> and persist the preference
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    }
    if (next === "system") {
      const prefersDark =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      setResolvedTheme(prefersDark ? "dark" : "light");
    } else {
      setResolvedTheme(next);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const prefersDark =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const stored =
      typeof window !== "undefined"
        ? (window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null)
        : null;
    setTheme(nextTheme(stored ?? theme, prefersDark));
  }, [setTheme, theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

export { ThemeContext };
