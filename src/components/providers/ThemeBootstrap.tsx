/**
 * ThemeBootstrap — inlines a synchronous script in <head> so the `dark`
 * class is applied on <html> BEFORE React hydrates. Prevents the
 * flash-of-unstyled-content (FOUC) when loading a page in dark mode.
 *
 * Storage key ("theme") must stay in sync with THEME_STORAGE_KEY in
 * `src/lib/context/ThemeContext.tsx`.
 */
export default function ThemeBootstrap() {
  const script = `
(function() {
  try {
    var stored = window.localStorage.getItem("theme");
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var resolved;
    if (stored === "light" || stored === "dark") {
      resolved = stored;
    } else {
      resolved = prefersDark ? "dark" : "light";
    }
    var cls = document.documentElement.classList;
    if (resolved === "dark") {
      cls.add("dark");
    } else {
      cls.remove("dark");
    }
  } catch (e) { /* no-op, keep default theme */ }
})();
`.trim();

  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
