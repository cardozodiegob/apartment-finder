/**
 * Test-database blog article fixtures for the sprint runner.
 *
 * Three sample published articles across the blog categories. The `slug`
 * field is the idempotency key used by `seedTestDatabase`.
 *
 * Requirements: 12.2
 */

import type { Types } from "mongoose";

export interface BlogArticleFixture {
  readonly title: string;
  readonly slug: string;
  readonly body: string;
  readonly category:
    | "moving_guides"
    | "city_guides"
    | "rental_tips"
    | "expat_life";
  readonly authorId?: Types.ObjectId | string;
  readonly featuredImageUrl?: string;
  readonly isPublished: boolean;
  readonly publishedAt: Date;
}

export interface BlogArticleFixtureAuthors {
  /** Fixture admin user ObjectId; set as the article authorId. */
  readonly adminId: Types.ObjectId | string;
}

export function buildBlogArticleFixtures(
  authors: BlogArticleFixtureAuthors,
): BlogArticleFixture[] {
  const authorId = authors.adminId;
  const publishedAt = new Date("2025-01-15T10:00:00.000Z");

  return [
    {
      title: "Moving to Berlin: a practical first-week guide",
      slug: "moving-to-berlin-first-week",
      body:
        "Covers Anmeldung, SIM cards, opening a bank account, and finding " +
        "a short-term place to land before signing a long-term lease.",
      category: "moving_guides",
      authorId,
      isPublished: true,
      publishedAt,
    },
    {
      title: "Amsterdam neighborhoods compared: Jordaan vs Oud-West",
      slug: "amsterdam-jordaan-vs-oud-west",
      body:
        "A side-by-side look at two popular Amsterdam neighborhoods — " +
        "price, transit, amenities, and typical tenant profile.",
      category: "city_guides",
      authorId,
      isPublished: true,
      publishedAt,
    },
    {
      title: "Spotting rental scams: a five-signal checklist",
      slug: "rental-scam-five-signal-checklist",
      body:
        "A short, actionable checklist for renters: off-platform payment " +
        "requests, photos lifted from other sites, absentee landlords, " +
        "rushed timelines, and identity-document asks.",
      category: "rental_tips",
      authorId,
      isPublished: true,
      publishedAt,
    },
  ];
}
