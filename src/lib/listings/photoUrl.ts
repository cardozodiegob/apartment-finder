/**
 * Photo adapter utilities — let UI code work with either legacy
 * `string[]` photos or the new `{ url, order, caption?, alt? }[]` shape.
 *
 * After the Phase 1 migration completes you can safely drop the string[]
 * branch, but until then these helpers keep every view rendering correctly.
 */

export interface PhotoLike {
  url: string;
  order?: number;
  caption?: string;
  alt?: string;
}

export type PhotoValue = string | PhotoLike;

/**
 * Returns the URL for a photo regardless of shape.
 */
export function photoUrl(p: PhotoValue | null | undefined): string {
  if (!p) return "";
  if (typeof p === "string") return p;
  return p.url ?? "";
}

/**
 * Returns the first valid URL from an array of photos, or an empty string.
 */
export function firstPhotoUrl(
  photos: ReadonlyArray<PhotoValue> | null | undefined,
): string {
  if (!photos || photos.length === 0) return "";
  return photoUrl(photos[0]);
}

/**
 * Returns all photo URLs in their stored order.
 */
export function photoUrls(
  photos: ReadonlyArray<PhotoValue> | null | undefined,
): string[] {
  if (!photos) return [];
  return photos.map(photoUrl).filter((u) => u.length > 0);
}
