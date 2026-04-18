/**
 * Response-metrics helper.
 *
 * Computes trailing 90-day `responseRate` and `responseTimeHours` for a user
 * and caches the result on `user.responseMetrics`. Intended to be called
 * lazily from the profile API, or in a nightly cron.
 *
 * Definitions:
 * - A "conversation" = first message received by the user in a thread
 *   created within the window.
 * - Response rate = conversations answered by user / total conversations
 * - Response time = mean hours between the first inbound message and the
 *   user's first reply within that thread.
 */

import dbConnect from "@/lib/db/connection";
import User from "@/lib/db/models/User";
import Message from "@/lib/db/models/Message";
import MessageThread from "@/lib/db/models/MessageThread";
import { Types } from "mongoose";

const WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

export interface ResponseMetrics {
  rate: number;
  timeHours: number;
  sampleSize: number;
  windowStartAt: Date;
}

export async function computeResponseMetrics(
  userId: string | Types.ObjectId,
): Promise<ResponseMetrics> {
  await dbConnect();

  const start = new Date(Date.now() - WINDOW_MS);
  const uid = typeof userId === "string" ? new Types.ObjectId(userId) : userId;

  // Threads this user is a participant in, active in the window
  const threads = await MessageThread.find({
    participants: uid,
    lastMessageAt: { $gte: start },
  })
    .select({ _id: 1 })
    .lean<{ _id: Types.ObjectId }[]>();

  if (threads.length === 0) {
    return { rate: 0, timeHours: 0, sampleSize: 0, windowStartAt: start };
  }

  const threadIds = threads.map((t) => t._id);
  const messages = await Message.find({ threadId: { $in: threadIds } })
    .select({ threadId: 1, senderId: 1, createdAt: 1 })
    .sort({ createdAt: 1 })
    .lean<{
      threadId: Types.ObjectId;
      senderId: Types.ObjectId;
      createdAt: Date;
    }[]>();

  const byThread = new Map<string, typeof messages>();
  for (const m of messages) {
    const key = String(m.threadId);
    const list = byThread.get(key) ?? [];
    list.push(m);
    byThread.set(key, list);
  }

  let answered = 0;
  let totalInbound = 0;
  let totalDeltaMs = 0;

  for (const list of byThread.values()) {
    // Find first inbound (someone other than user)
    const firstInbound = list.find((m) => String(m.senderId) !== String(uid));
    if (!firstInbound) continue;
    totalInbound += 1;

    const reply = list.find(
      (m) =>
        String(m.senderId) === String(uid) &&
        m.createdAt.getTime() > firstInbound.createdAt.getTime(),
    );
    if (reply) {
      answered += 1;
      totalDeltaMs += reply.createdAt.getTime() - firstInbound.createdAt.getTime();
    }
  }

  const rate = totalInbound === 0 ? 0 : answered / totalInbound;
  const timeHours = answered === 0 ? 0 : totalDeltaMs / answered / (1000 * 60 * 60);

  return {
    rate,
    timeHours: Math.round(timeHours * 10) / 10,
    sampleSize: totalInbound,
    windowStartAt: start,
  };
}

export async function refreshResponseMetrics(userId: string | Types.ObjectId): Promise<ResponseMetrics> {
  const metrics = await computeResponseMetrics(userId);
  await User.updateOne(
    { _id: userId },
    { $set: { responseMetrics: metrics } },
  );
  return metrics;
}
