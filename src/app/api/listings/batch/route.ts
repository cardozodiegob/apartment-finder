import { NextRequest } from "next/server";
import dbConnect from "@/lib/db/connection";
import Listing from "@/lib/db/models/Listing";
import { errorResponse } from "@/lib/api/errors";

/**
 * GET /api/listings/batch?ids=id1,id2,id3
 *
 * Returns up to 20 listings by id. Used by the recently-viewed strip on the
 * search page. Draft listings are omitted.
 */
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const idsParam = req.nextUrl.searchParams.get("ids");
    if (!idsParam) return Response.json({ listings: [] });

    const ids = idsParam.split(",").filter(Boolean).slice(0, 20);
    if (ids.length === 0) return Response.json({ listings: [] });

    const listings = await Listing.find({
      _id: { $in: ids },
      status: { $ne: "draft" },
    }).lean();

    // Preserve caller order
    const byId = new Map(listings.map((l) => [String(l._id), l]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((l): l is NonNullable<typeof l> => Boolean(l));

    return Response.json({ listings: ordered });
  } catch (error) {
    return errorResponse(error);
  }
}
