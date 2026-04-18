import dbConnect from "@/lib/db/connection";
import MessageThread from "@/lib/db/models/MessageThread";
import Message from "@/lib/db/models/Message";
import Listing from "@/lib/db/models/Listing";
import User from "@/lib/db/models/User";
import Notification from "@/lib/db/models/Notification";
import { sendEmail } from "@/lib/services/email";
import type { IMessage } from "@/lib/db/models/Message";
import type { IMessageThread } from "@/lib/db/models/MessageThread";

export async function sendMessage(
  senderId: string,
  listingId: string,
  body: string
): Promise<{ message: IMessage | null; error: string | null }> {
  try {
    await dbConnect();

    // 1. Check if sender is suspended
    const sender = await User.findById(senderId);
    if (!sender) return { message: null, error: "Sender not found" };
    if (sender.isSuspended) {
      return { message: null, error: "Suspended users cannot send messages" };
    }

    // 2. Look up listing to get poster ID
    const listing = await Listing.findById(listingId);
    if (!listing) return { message: null, error: "Listing not found" };

    const posterId = listing.posterId.toString();
    const recipientId = posterId === senderId ? null : posterId;

    // Determine the two participants (sender + poster)
    const participantIds = [senderId, posterId].sort();

    // 3. Find existing thread or create one
    let thread = await MessageThread.findOne({
      listingId,
      participants: { $all: participantIds },
    });

    if (!thread) {
      thread = await MessageThread.create({
        listingId,
        participants: participantIds,
        lastMessageAt: new Date(),
      });
    }

    // 4. Create the message
    const message = await Message.create({
      threadId: thread._id,
      senderId,
      body,
    });

    // 5. Update thread's lastMessageAt
    thread.lastMessageAt = new Date();
    await thread.save();

    // 6. Create in-app notification for recipient
    if (recipientId) {
      await Notification.create({
        userId: recipientId,
        type: "message",
        title: "New message",
        body: `${sender.fullName} sent you a message about a listing`,
        metadata: { threadId: thread._id.toString(), listingId },
      });

      // 7. Send email if recipient has email notifications enabled
      const recipient = await User.findById(recipientId);
      if (recipient?.notificationPreferences?.email) {
        await sendEmail({
          to: recipient.email,
          template: "payment_confirmation", // reuse existing template for now
          locale: recipient.preferredLanguage || "en",
          data: {
            heading: "New Message",
            body: `${sender.fullName} sent you a message about a listing.`,
          },
        });
      }
    }

    return { message, error: null };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to send message";
    return { message: null, error: msg };
  }
}


export async function getThreads(
  userId: string
): Promise<{ threads: IMessageThread[]; error: string | null }> {
  try {
    await dbConnect();
    const threads = await MessageThread.find({
      participants: userId,
    }).sort({ lastMessageAt: -1 });
    return { threads, error: null };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to get threads";
    return { threads: [], error: msg };
  }
}

export async function getMessages(
  threadId: string,
  userId: string
): Promise<{ messages: IMessage[]; error: string | null }> {
  try {
    await dbConnect();

    // Verify user is a participant
    const thread = await MessageThread.findById(threadId);
    if (!thread) return { messages: [], error: "Thread not found" };

    const isParticipant = thread.participants.some(
      (p) => p.toString() === userId
    );
    if (!isParticipant) {
      return { messages: [], error: "Not authorized to view this thread" };
    }

    const messages = await Message.find({ threadId }).sort({ createdAt: 1 });

    // Mark thread as read for this user
    thread.readBy.set(userId, new Date());
    await thread.save();

    return { messages, error: null };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to get messages";
    return { messages: [], error: msg };
  }
}
