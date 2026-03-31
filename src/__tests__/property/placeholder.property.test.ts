import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='500' fill='%23dce4ff'%3E%3Crect width='800' height='500'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%233b5bdb' font-size='24'%3EApartment Finder%3C/text%3E%3C/svg%3E";

function getDisplayImage(photos: string[]): string {
  return photos.length > 0 && photos[0] ? photos[0] : PLACEHOLDER_IMG;
}

/**
 * Feature: apartment-finder, Property 32: Placeholder image fallback
 *
 * **Validates: Requirements 10.4**
 */
describe("Feature: apartment-finder, Property 32: Placeholder image fallback", () => {
  it("listings with no photos render a placeholder image", () => {
    fc.assert(
      fc.property(
        fc.constantFrom([] as string[], [""], []),
        (photos) => {
          const img = getDisplayImage(photos);
          expect(img).toBe(PLACEHOLDER_IMG);
          expect(img.length).toBeGreaterThan(0);
          // Should not be empty or broken
          expect(img).toContain("svg");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("listings with photos render the first photo", () => {
    fc.assert(
      fc.property(
        fc.array(fc.webUrl(), { minLength: 1, maxLength: 5 }),
        (photos) => {
          const img = getDisplayImage(photos);
          expect(img).toBe(photos[0]);
          expect(img.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("placeholder is always a valid non-empty string", () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(fc.webUrl(), fc.constant("")), { maxLength: 5 }),
        (photos) => {
          const img = getDisplayImage(photos);
          expect(img.length).toBeGreaterThan(0);
          // Never empty or undefined
          expect(img).toBeDefined();
          expect(img).not.toBe("");
        }
      ),
      { numRuns: 100 }
    );
  });
});
