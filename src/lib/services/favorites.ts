import dbConnect from "@/lib/db/connection";
import Favorite from "@/lib/db/models/Favorite";
import type { IFavorite } from "@/lib/db/models/Favorite";

export async function addFavorite(
  userId: string,
  listingId: string
): Promise<{ error: string | null }> {
  try {
    await dbConnect();
    await Favorite.updateOne(
      { userId, listingId },
      { $setOnInsert: { userId, listingId, savedAt: new Date() } },
      { upsert: true }
    );
    return { error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to add favorite";
    return { error: msg };
  }
}

export async function removeFavorite(
  userId: string,
  listingId: string
): Promise<{ error: string | null }> {
  try {
    await dbConnect();
    await Favorite.deleteOne({ userId, listingId });
    return { error: null };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to remove favorite";
    return { error: msg };
  }
}

export async function getFavorites(
  userId: string
): Promise<{ favorites: IFavorite[]; error: string | null }> {
  try {
    await dbConnect();
    const favorites = await Favorite.find({ userId }).sort({ savedAt: -1 });
    return { favorites, error: null };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to get favorites";
    return { favorites: [], error: msg };
  }
}

export async function isFavorited(
  userId: string,
  listingId: string
): Promise<boolean> {
  try {
    await dbConnect();
    const doc = await Favorite.findOne({ userId, listingId }).lean();
    return !!doc;
  } catch {
    return false;
  }
}
