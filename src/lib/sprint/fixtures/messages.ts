/**
 * Test-database message thread / message fixtures for the sprint runner.
 *
 * Produces a single thread between the `student_sharer` and the
 * `landlord_poster` fixture users, keyed by the `amsterdam-jordaan-room`
 * listing, plus a handful of messages along that thread.
 *
 * Requirements: 12.2
 */

import type { Types } from "mongoose";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MessageThreadFixture {
  /** Stable idempotency key used by the seeder for upserts. */
  readonly fixtureKey: string;
  readonly listingId: Types.ObjectId | string;
  readonly participants: readonly [
    Types.ObjectId | string,
    Types.ObjectId | string,
  ];
  readonly lastMessageAt: Date;
}

export interface MessageFixture {
  /** Stable idempotency key used by the seeder for upserts. */
  readonly fixtureKey: string;
  /**
   * Key of the thread this message belongs to. The seeder resolves this
   * to the persisted thread's ObjectId.
   */
  readonly threadFixtureKey: string;
  readonly senderId: Types.ObjectId | string;
  readonly body: string;
  readonly createdAt: Date;
}

export interface MessageFixtureBundle {
  readonly threads: MessageThreadFixture[];
  readonly messages: MessageFixture[];
}

export interface MessageFixtureParticipants {
  readonly studentSharerId: Types.ObjectId | string;
  readonly landlordPosterId: Types.ObjectId | string;
  /** ObjectId of the `amsterdam-jordaan-room` listing fixture. */
  readonly jordaanRoomListingId: Types.ObjectId | string;
}

// ---------------------------------------------------------------------------
// Fixture builder
// ---------------------------------------------------------------------------

export function buildMessageFixtures(
  participants: MessageFixtureParticipants,
): MessageFixtureBundle {
  const { studentSharerId, landlordPosterId, jordaanRoomListingId } =
    participants;

  const base = new Date("2025-02-10T09:00:00.000Z").getTime();
  const at = (offsetMinutes: number) => new Date(base + offsetMinutes * 60_000);

  const threadKey = "jordaan-room-student-landlord";

  const threads: MessageThreadFixture[] = [
    {
      fixtureKey: threadKey,
      listingId: jordaanRoomListingId,
      participants: [studentSharerId, landlordPosterId],
      lastMessageAt: at(60),
    },
  ];

  const messages: MessageFixture[] = [
    {
      fixtureKey: `${threadKey}-0`,
      threadFixtureKey: threadKey,
      senderId: studentSharerId,
      body: "Hi! Is the shared room in Jordaan still available from March?",
      createdAt: at(0),
    },
    {
      fixtureKey: `${threadKey}-1`,
      threadFixtureKey: threadKey,
      senderId: landlordPosterId,
      body: "Yes, from 1 March. Two current flatmates, both in their 20s.",
      createdAt: at(15),
    },
    {
      fixtureKey: `${threadKey}-2`,
      threadFixtureKey: threadKey,
      senderId: studentSharerId,
      body: "Great — could I book a viewing next week?",
      createdAt: at(30),
    },
    {
      fixtureKey: `${threadKey}-3`,
      threadFixtureKey: threadKey,
      senderId: landlordPosterId,
      body: "Sure, Wednesday at 18:00 works. I'll send the address.",
      createdAt: at(45),
    },
    {
      fixtureKey: `${threadKey}-4`,
      threadFixtureKey: threadKey,
      senderId: studentSharerId,
      body: "Perfect — see you Wednesday.",
      createdAt: at(60),
    },
  ];

  return { threads, messages };
}
