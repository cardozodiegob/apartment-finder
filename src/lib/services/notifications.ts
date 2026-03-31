import Notification from "@/lib/db/models/Notification";
import User from "@/lib/db/models/User";
import type { INotification, NotificationType } from "@/lib/db/models/Notification";
import type { INotificationPreferences } from "@/lib/db/models/User";

// --- Types ---

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

// Critical event types that also trigger email
const CRITICAL_TYPES: NotificationType[] = ["payment", "security", "report"];

// --- Helpers ---

export function isCriticalEvent(type: NotificationType): boolean {
  return CRITICAL_TYPES.includes(type);
}

export function shouldDeliver(
  type: NotificationType,
  preferences: INotificationPreferences
): boolean {
  if (!preferences.inApp) return false;
  switch (type) {
    case "payment": return preferences.payment;
    case "security": return preferences.security;
    case "listing_status": return preferences.listing;
    case "report": return preferences.report;
    case "message": return preferences.inApp;
    case "roommate_request": return preferences.inApp;
    default: return true;
  }
}

export function shouldSendEmail(
  type: NotificationType,
  preferences: INotificationPreferences
): boolean {
  if (!preferences.email) return false;
  return isCriticalEvent(type);
}

// --- Service ---

export async function send(input: NotificationInput): Promise<{ notification: INotification | null; error: string | null }> {
  try {
    // Check user preferences
    const user = await User.findById(input.userId);
    if (!user) return { notification: null, error: "User not found" };

    if (!shouldDeliver(input.type, user.notificationPreferences)) {
      return { notification: null, error: null }; // Silently skip
    }

    const notification = await Notification.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      metadata: input.metadata,
    });

    // Send email for critical events
    if (shouldSendEmail(input.type, user.notificationPreferences)) {
      // In production: await sendEmail(user.email, input.title, input.body);
      // For now, we log the intent
    }

    return { notification, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to send notification";
    return { notification: null, error: msg };
  }
}

export async function getForUser(
  userId: string,
  unreadOnly = false
): Promise<{ notifications: INotification[]; error: string | null }> {
  try {
    const query: Record<string, unknown> = { userId, isDismissed: false };
    if (unreadOnly) query.isRead = false;
    const notifications = await Notification.find(query).sort({ createdAt: -1 });
    return { notifications, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to get notifications";
    return { notifications: [], error: msg };
  }
}

export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<{ error: string | null }> {
  try {
    const notification = await Notification.findById(notificationId);
    if (!notification) return { error: "Notification not found" };
    if (notification.userId.toString() !== userId) return { error: "Not authorized" };
    notification.isRead = true;
    await notification.save();
    return { error: null };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to mark as read" };
  }
}

export async function dismiss(
  notificationId: string,
  userId: string
): Promise<{ error: string | null }> {
  try {
    const notification = await Notification.findById(notificationId);
    if (!notification) return { error: "Notification not found" };
    if (notification.userId.toString() !== userId) return { error: "Not authorized" };
    notification.isDismissed = true;
    await notification.save();
    return { error: null };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to dismiss" };
  }
}

export async function updatePreferences(
  userId: string,
  prefs: Partial<INotificationPreferences>
): Promise<{ error: string | null }> {
  try {
    const user = await User.findById(userId);
    if (!user) return { error: "User not found" };
    Object.assign(user.notificationPreferences, prefs);
    await user.save();
    return { error: null };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to update preferences" };
  }
}
