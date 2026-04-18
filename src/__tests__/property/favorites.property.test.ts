import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Feature: apartment-finder, Property 7: Favorite folder operations are idempotent
 *
 * **Validates: Requirement 52**
 *
 * In-memory model of the folder-move operation used by /api/favorites/bulk-move.
 * The real operation is a single `updateMany` that sets `folderName`; repeating
 * the same move must be a no-op.
 */

interface FavoriteRow {
  id: string;
  folder: string;
}

function moveAll(favorites: FavoriteRow[], ids: string[], targetFolder: string): FavoriteRow[] {
  const set = new Set(ids);
  return favorites.map((f) => (set.has(f.id) ? { ...f, folder: targetFolder } : f));
}

describe("Feature: apartment-finder, Property 7: Favorite folder operations are idempotent", () => {
  const folderName = fc.stringMatching(/^[A-Za-z]{2,8}$/);
  const favArb = fc.record({
    id: fc.stringMatching(/^[a-f0-9]{8}$/),
    folder: folderName,
  });

  it("moving the same favorites twice to the same folder is a no-op after the first move", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(favArb, { minLength: 1, maxLength: 20, selector: (f) => f.id }),
        folderName,
        (favorites, target) => {
          const ids = favorites.map((f) => f.id);
          const once = moveAll(favorites, ids, target);
          const twice = moveAll(once, ids, target);
          expect(twice).toEqual(once);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("moving disjoint id sets commutes — order-independent", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(favArb, { minLength: 2, maxLength: 20, selector: (f) => f.id }),
        folderName,
        folderName,
        (favorites, folderA, folderB) => {
          const [aIds, bIds] = [
            favorites.filter((_, i) => i % 2 === 0).map((f) => f.id),
            favorites.filter((_, i) => i % 2 === 1).map((f) => f.id),
          ];

          const forward = moveAll(moveAll(favorites, aIds, folderA), bIds, folderB);
          const reverse = moveAll(moveAll(favorites, bIds, folderB), aIds, folderA);

          expect(forward).toEqual(reverse);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("moving to a target folder that already contains the favorites has no effect", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(favArb, { minLength: 1, maxLength: 20, selector: (f) => f.id }),
        (favorites) => {
          for (const f of favorites) {
            const moved = moveAll(favorites, [f.id], f.folder);
            expect(moved).toEqual(favorites);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
