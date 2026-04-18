/**
 * Shared SWR fetcher for admin sprint routes.
 *
 * Throws on non-2xx responses so SWR surfaces them via the `error`
 * channel. The thrown value carries the HTTP status so callers can
 * branch on 403 vs. 404 without re-fetching.
 */

export class FetchError extends Error {
  public readonly status: number;
  public readonly body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let body: unknown = undefined;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    throw new FetchError(
      res.status,
      `Request to ${url} failed with ${res.status}`,
      body,
    );
  }
  return (await res.json()) as T;
}
