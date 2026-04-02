/**
 * Input sanitization utilities.
 * Regex-based HTML stripping — no external dependencies.
 */

/** Tags allowed by sanitizeHtml (basic formatting only) */
const ALLOWED_TAGS = new Set(["b", "i", "em", "strong", "p", "br", "ul", "ol", "li"]);

/**
 * Strip all HTML tags except basic formatting tags.
 * Allowed: b, i, em, strong, p, br, ul, ol, li
 */
export function sanitizeHtml(input: string): string {
  if (!input) return "";

  // Replace disallowed tags while keeping allowed ones
  return input.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/gi, (match, tagName: string) => {
    const lower = tagName.toLowerCase();
    if (ALLOWED_TAGS.has(lower)) {
      // Keep the tag but strip any attributes for safety
      const isClosing = match.startsWith("</");
      const isSelfClosing = lower === "br";
      if (isClosing) return `</${lower}>`;
      if (isSelfClosing) return `<${lower} />`;
      return `<${lower}>`;
    }
    return "";
  });
}

/**
 * Strip ALL HTML tags and trim whitespace.
 */
export function sanitizeText(input: string): string {
  if (!input) return "";
  return input.replace(/<[^>]*>/g, "").trim();
}
