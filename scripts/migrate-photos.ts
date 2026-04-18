/**
 * scripts/migrate-photos.ts
 *
 * One-shot (and idempotent) migration that rewrites every Listing document's
 * `photos` field from legacy `string[]` to the new
 * `[{ url, order, caption?, alt? }]` shape.
 *
 * Run with:
 *   npx tsx scripts/migrate-photos.ts
 *
 * The script is idempotent — running it multiple times leaves already-migrated
 * documents unchanged. Safe to re-run after a partial failure.
 */

import dbConnect from "../src/lib/db/connection";
import Listing from "../src/lib/db/models/Listing";

interface RawPhoto {
  url?: string;
  order?: number;
  caption?: string;
  alt?: string;
}

function isObjectPhoto(p: unknown): p is RawPhoto {
  return typeof p === "object" && p !== null && "url" in p;
}

async function main() {
  await dbConnect();
  console.log("[migrate-photos] connected to MongoDB");

  // Only consider documents with non-empty `photos`.
  const cursor = Listing.find({ "photos.0": { $exists: true } }).cursor();

  let scanned = 0;
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for await (const doc of cursor) {
    scanned += 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const photos = (doc as any).photos as unknown[];

    // Already in new shape? skip.
    if (photos.every(isObjectPhoto)) {
      skipped += 1;
      continue;
    }

    const next = photos.map((p, i) => {
      if (typeof p === "string") return { url: p, order: i };
      if (isObjectPhoto(p)) {
        return {
          url: p.url ?? "",
          order: typeof p.order === "number" ? p.order : i,
          caption: p.caption,
          alt: p.alt,
        };
      }
      return { url: "", order: i };
    });

    try {
      await Listing.updateOne(
        { _id: doc._id },
        { $set: { photos: next } },
      );
      migrated += 1;
    } catch (err) {
      console.error(`[migrate-photos] failed for ${doc._id}:`, err);
      failed += 1;
    }
  }

  console.log(
    `[migrate-photos] done — scanned=${scanned} migrated=${migrated} skipped=${skipped} failed=${failed}`,
  );

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[migrate-photos] fatal:", err);
  process.exit(1);
});
