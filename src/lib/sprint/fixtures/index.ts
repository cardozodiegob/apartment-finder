/**
 * Seed the sprint-owned test database with a fixed set of fixtures.
 *
 * Design contract: the caller is responsible for pointing the default
 * mongoose connection at the sprint test database before calling
 * `seedTestDatabase()` — typically by setting `MONGODB_URI` to the URI
 * returned by `createTestDatabase()` and then invoking `dbConnect()`.
 * Inside the child Next.js test instance this happens automatically
 * because the process env is set before the app boots.
 *
 * Every collection write uses `findOneAndUpdate` with `upsert: true`
 * keyed on a stable field (email, slug, fixtureKey, etc.) so repeated
 * invocations converge on the same state.
 *
 * Requirements: 12.2
 */

import dbConnect from "@/lib/db/connection";
import {
  User,
  Listing,
  NeighborhoodGuide,
  BlogArticle,
  Message,
} from "@/lib/db/models";
import MessageThread from "@/lib/db/models/MessageThread";

import { buildUserFixtures, type UserFixture } from "./users";
import { buildListingFixtures, type ListingFixture } from "./listings";
import {
  buildNeighborhoodFixtures,
  type NeighborhoodFixture,
} from "./neighborhoods";
import {
  buildBlogArticleFixtures,
  type BlogArticleFixture,
} from "./blog-articles";
import {
  buildMessageFixtures,
  type MessageFixture,
  type MessageThreadFixture,
} from "./messages";

// Re-export fixture builders and types so callers (tests, runner) have a
// single entry point.
export {
  buildUserFixtures,
  FIXTURE_USER_PASSWORD,
  type UserFixture,
} from "./users";
export { buildListingFixtures, type ListingFixture } from "./listings";
export {
  buildNeighborhoodFixtures,
  type NeighborhoodFixture,
} from "./neighborhoods";
export {
  buildBlogArticleFixtures,
  type BlogArticleFixture,
} from "./blog-articles";
export {
  buildMessageFixtures,
  type MessageFixture,
  type MessageThreadFixture,
  type MessageFixtureBundle,
} from "./messages";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SeedSummary {
  readonly users: number;
  readonly listings: number;
  readonly neighborhoods: number;
  readonly blogArticles: number;
  readonly messageThreads: number;
  readonly messages: number;
}

export interface SeedTestDatabaseOptions {
  /**
   * When true, existing non-fixture records in the target collections are
   * preserved; fixtures are still upserted idempotently. Reserved for
   * future use — currently a no-op marker.
   */
  readonly preserveExisting?: boolean;
}

// ---------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------

/**
 * Seed the currently-connected MongoDB with the sprint runner fixture set.
 *
 * Idempotent: running it twice produces the same final state.
 */
export async function seedTestDatabase(
  _options?: SeedTestDatabaseOptions,
): Promise<SeedSummary> {
  // Ensure the default mongoose connection is open. The caller is expected
  // to have set MONGODB_URI to the sprint-test URI before this point.
  await dbConnect();

  // ---- Users --------------------------------------------------------------
  const userFixtures: UserFixture[] = buildUserFixtures();
  const userDocs = new Map<string, unknown>();
  for (const u of userFixtures) {
    const doc = await User.findOneAndUpdate(
      { email: u.email },
      {
        $set: {
          supabaseId: u.supabaseId,
          email: u.email,
          fullName: u.fullName,
          role: u.role,
          preferredLanguage: u.preferredLanguage,
          preferredCurrency: u.preferredCurrency,
          idVerified: u.idVerified,
          profileCompleted: u.profileCompleted,
          bio: u.bio,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    if (doc) userDocs.set(u.fixturePersona, doc);
  }

  const landlordPoster = userDocs.get("landlord_poster") as
    | { _id: unknown }
    | undefined;
  const studentSharer = userDocs.get("student_sharer") as
    | { _id: unknown }
    | undefined;
  const admin = userDocs.get("admin") as { _id: unknown } | undefined;
  if (!landlordPoster || !studentSharer || !admin) {
    throw new Error(
      "seedTestDatabase: core fixture users missing after upsert " +
        "(landlord_poster, student_sharer, admin are all required)",
    );
  }

  // ---- Listings -----------------------------------------------------------
  const listingFixtures: ListingFixture[] = buildListingFixtures({
    landlordPosterId: landlordPoster._id as string,
  });
  const listingIdByKey = new Map<string, unknown>();
  for (const l of listingFixtures) {
    const doc = await Listing.findOneAndUpdate(
      {
        posterId: l.posterId,
        title: l.title,
        "address.city": l.address.city,
      },
      {
        $set: {
          posterId: l.posterId,
          title: l.title,
          description: l.description,
          propertyType: l.propertyType,
          purpose: l.purpose,
          address: l.address,
          location: l.location,
          monthlyRent: l.monthlyRent,
          currency: l.currency,
          availableDate: l.availableDate,
          photos: l.photos,
          photoHashes: l.photoHashes,
          tags: l.tags,
          isSharedAccommodation: l.isSharedAccommodation,
          availableRooms: l.availableRooms,
          isFurnished: l.isFurnished,
          hasParking: l.hasParking,
          hasBalcony: l.hasBalcony,
          floorArea: l.floorArea,
          status: l.status,
          isFeatured: l.isFeatured,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    if (doc) listingIdByKey.set(l.fixtureKey, (doc as { _id: unknown })._id);
  }

  // ---- Neighborhood guides ----------------------------------------------
  const neighborhoodFixtures: NeighborhoodFixture[] = buildNeighborhoodFixtures({
    updatedBy: admin._id as string,
  });
  for (const n of neighborhoodFixtures) {
    await NeighborhoodGuide.findOneAndUpdate(
      { slug: n.slug },
      {
        $set: {
          city: n.city,
          neighborhood: n.neighborhood,
          slug: n.slug,
          overview: n.overview,
          transitScore: n.transitScore,
          transitInfo: n.transitInfo,
          safetyInfo: n.safetyInfo,
          amenities: n.amenities,
          averageRent: n.averageRent,
          centerLat: n.centerLat,
          centerLng: n.centerLng,
          isPublished: n.isPublished,
          updatedBy: n.updatedBy,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
  }

  // ---- Blog articles -----------------------------------------------------
  const blogFixtures: BlogArticleFixture[] = buildBlogArticleFixtures({
    adminId: admin._id as string,
  });
  for (const b of blogFixtures) {
    await BlogArticle.findOneAndUpdate(
      { slug: b.slug },
      {
        $set: {
          title: b.title,
          slug: b.slug,
          body: b.body,
          category: b.category,
          authorId: b.authorId,
          featuredImageUrl: b.featuredImageUrl,
          isPublished: b.isPublished,
          publishedAt: b.publishedAt,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
  }

  // ---- Message threads + messages ---------------------------------------
  const jordaanListingId = listingIdByKey.get("amsterdam-jordaan-room");
  let messageThreads = 0;
  let messages = 0;

  if (jordaanListingId) {
    const { threads, messages: messageFixtures } = buildMessageFixtures({
      studentSharerId: studentSharer._id as string,
      landlordPosterId: landlordPoster._id as string,
      jordaanRoomListingId: jordaanListingId as string,
    });

    const threadIdByKey = new Map<string, unknown>();
    for (const t of threads as MessageThreadFixture[]) {
      const doc = await MessageThread.findOneAndUpdate(
        {
          listingId: t.listingId,
          participants: { $all: t.participants },
        },
        {
          $set: {
            listingId: t.listingId,
            participants: t.participants,
            lastMessageAt: t.lastMessageAt,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean();
      if (doc) {
        threadIdByKey.set(t.fixtureKey, (doc as { _id: unknown })._id);
        messageThreads += 1;
      }
    }

    for (const m of messageFixtures as MessageFixture[]) {
      const threadId = threadIdByKey.get(m.threadFixtureKey);
      if (!threadId) continue;
      // Idempotency: (threadId, senderId, createdAt) is a stable tuple.
      const res = await Message.findOneAndUpdate(
        { threadId, senderId: m.senderId, createdAt: m.createdAt },
        {
          $set: {
            threadId,
            senderId: m.senderId,
            body: m.body,
            createdAt: m.createdAt,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean();
      if (res) messages += 1;
    }
  }

  return {
    users: userFixtures.length,
    listings: listingFixtures.length,
    neighborhoods: neighborhoodFixtures.length,
    blogArticles: blogFixtures.length,
    messageThreads,
    messages,
  };
}
