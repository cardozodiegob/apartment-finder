import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for messaging service
 * Validates: Requirements 16.1, 16.4, 16.5
 */

// --- Mocks ---

vi.mock("@/lib/db/connection", () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

const mockUserFindById = vi.fn();
vi.mock("@/lib/db/models/User", () => ({
  default: {
    findById: (...args: unknown[]) => mockUserFindById(...args),
  },
}));

const mockListingFindById = vi.fn();
vi.mock("@/lib/db/models/Listing", () => ({
  default: {
    findById: (...args: unknown[]) => mockListingFindById(...args),
  },
}));

const mockThreadFindOne = vi.fn();
const mockThreadCreate = vi.fn();
const mockThreadFindById = vi.fn();
const mockThreadFind = vi.fn();
vi.mock("@/lib/db/models/MessageThread", () => ({
  default: {
    findOne: (...args: unknown[]) => mockThreadFindOne(...args),
    create: (...args: unknown[]) => mockThreadCreate(...args),
    findById: (...args: unknown[]) => mockThreadFindById(...args),
    find: (...args: unknown[]) => mockThreadFind(...args),
  },
}));

const mockMessageCreate = vi.fn();
const mockMessageFind = vi.fn();
vi.mock("@/lib/db/models/Message", () => ({
  default: {
    create: (...args: unknown[]) => mockMessageCreate(...args),
    find: (...args: unknown[]) => mockMessageFind(...args),
  },
}));

const mockNotificationCreate = vi.fn();
vi.mock("@/lib/db/models/Notification", () => ({
  default: {
    create: (...args: unknown[]) => mockNotificationCreate(...args),
  },
}));

vi.mock("@/lib/services/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));


// --- Tests ---

describe("Messages Service — Unit Tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Validates: Requirement 16.1
   * First message for a listing+sender pair creates a new thread.
   */
  it("sendMessage creates a new thread on first message", async () => {
    const senderId = "sender123";
    const posterId = "poster456";
    const listingId = "listing789";

    mockUserFindById.mockResolvedValueOnce({
      _id: senderId,
      fullName: "Alice",
      isSuspended: false,
    });
    mockListingFindById.mockResolvedValueOnce({
      _id: listingId,
      posterId: { toString: () => posterId },
    });
    // No existing thread
    mockThreadFindOne.mockResolvedValueOnce(null);
    const fakeThread = {
      _id: "thread1",
      listingId,
      participants: [posterId, senderId].sort(),
      lastMessageAt: new Date(),
      save: vi.fn().mockResolvedValue(undefined),
    };
    mockThreadCreate.mockResolvedValueOnce(fakeThread);
    const fakeMessage = {
      _id: "msg1",
      threadId: "thread1",
      senderId,
      body: "Hello",
      createdAt: new Date(),
    };
    mockMessageCreate.mockResolvedValueOnce(fakeMessage);
    // Recipient lookup for notification email
    mockUserFindById.mockResolvedValueOnce({
      _id: posterId,
      email: "poster@example.com",
      preferredLanguage: "en",
      notificationPreferences: { email: false },
    });
    mockNotificationCreate.mockResolvedValueOnce({});

    const { sendMessage } = await import("@/lib/services/messages");
    const result = await sendMessage(senderId, listingId, "Hello");

    expect(result.error).toBeNull();
    expect(result.message).toEqual(fakeMessage);
    expect(mockThreadCreate).toHaveBeenCalledTimes(1);
    expect(mockMessageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread1",
        senderId,
        body: "Hello",
      })
    );
  });

  /**
   * Validates: Requirement 16.1
   * Second message reuses the existing thread.
   */
  it("sendMessage reuses existing thread on subsequent messages", async () => {
    const senderId = "sender123";
    const posterId = "poster456";
    const listingId = "listing789";

    mockUserFindById.mockResolvedValueOnce({
      _id: senderId,
      fullName: "Alice",
      isSuspended: false,
    });
    mockListingFindById.mockResolvedValueOnce({
      _id: listingId,
      posterId: { toString: () => posterId },
    });
    const existingThread = {
      _id: "thread1",
      listingId,
      participants: [posterId, senderId].sort(),
      lastMessageAt: new Date(),
      save: vi.fn().mockResolvedValue(undefined),
    };
    mockThreadFindOne.mockResolvedValueOnce(existingThread);
    mockMessageCreate.mockResolvedValueOnce({
      _id: "msg2",
      threadId: "thread1",
      senderId,
      body: "Follow up",
    });
    mockUserFindById.mockResolvedValueOnce({
      _id: posterId,
      email: "poster@example.com",
      preferredLanguage: "en",
      notificationPreferences: { email: false },
    });
    mockNotificationCreate.mockResolvedValueOnce({});

    const { sendMessage } = await import("@/lib/services/messages");
    const result = await sendMessage(senderId, listingId, "Follow up");

    expect(result.error).toBeNull();
    expect(mockThreadCreate).not.toHaveBeenCalled();
    expect(existingThread.save).toHaveBeenCalled();
  });

  /**
   * Validates: Requirement 16.4
   * Suspended users cannot send messages.
   */
  it("sendMessage rejects suspended users", async () => {
    mockUserFindById.mockResolvedValueOnce({
      _id: "suspended1",
      fullName: "Bad Actor",
      isSuspended: true,
    });

    const { sendMessage } = await import("@/lib/services/messages");
    const result = await sendMessage("suspended1", "listing1", "Hi");

    expect(result.error).toBe("Suspended users cannot send messages");
    expect(result.message).toBeNull();
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  /**
   * Validates: Requirement 16.5
   * getMessages returns messages only if user is a participant.
   */
  it("getMessages returns messages for a participant", async () => {
    const userId = "user1";
    const threadId = "thread1";

    mockThreadFindById.mockResolvedValueOnce({
      _id: threadId,
      participants: [
        { toString: () => userId },
        { toString: () => "user2" },
      ],
    });
    const fakeMessages = [
      { _id: "msg1", threadId, senderId: userId, body: "Hi", createdAt: new Date() },
    ];
    mockMessageFind.mockReturnValueOnce({
      sort: vi.fn().mockResolvedValue(fakeMessages),
    });

    const { getMessages } = await import("@/lib/services/messages");
    const result = await getMessages(threadId, userId);

    expect(result.error).toBeNull();
    expect(result.messages).toEqual(fakeMessages);
  });

  /**
   * Validates: Requirement 16.5
   * getMessages denies access to non-participants.
   */
  it("getMessages denies access to non-participants", async () => {
    const threadId = "thread1";

    mockThreadFindById.mockResolvedValueOnce({
      _id: threadId,
      participants: [
        { toString: () => "user1" },
        { toString: () => "user2" },
      ],
    });

    const { getMessages } = await import("@/lib/services/messages");
    const result = await getMessages(threadId, "intruder");

    expect(result.error).toBe("Not authorized to view this thread");
    expect(result.messages).toEqual([]);
  });

  /**
   * Validates: Requirement 16.5
   * getThreads returns threads where user is a participant.
   */
  it("getThreads returns threads for a user", async () => {
    const userId = "user1";
    const fakeThreads = [
      { _id: "thread1", participants: [userId, "user2"], lastMessageAt: new Date() },
    ];
    mockThreadFind.mockReturnValueOnce({
      sort: vi.fn().mockResolvedValue(fakeThreads),
    });

    const { getThreads } = await import("@/lib/services/messages");
    const result = await getThreads(userId);

    expect(result.error).toBeNull();
    expect(result.threads).toEqual(fakeThreads);
    expect(mockThreadFind).toHaveBeenCalledWith({ participants: userId });
  });
});
