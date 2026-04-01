import { requireSessionUser } from "@/lib/api/session";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";
import { supabaseAdmin } from "@/lib/supabase/server";
import dbConnect from "@/lib/db/connection";
import User from "@/lib/db/models/User";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  try {
    const session = await requireSessionUser();
    await dbConnect();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "No file provided", 400);
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "File must be JPEG, PNG, or WebP", 400);
    }

    if (file.size > MAX_SIZE) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "File must be under 5MB", 400);
    }

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${session.mongoId}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from("profile-photos")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw new ApiErrorResponse("UPLOAD_ERROR", uploadError.message, 500);
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("profile-photos")
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;

    await User.findByIdAndUpdate(session.mongoId, { profilePhoto: publicUrl });

    return Response.json({ url: publicUrl });
  } catch (error) {
    return errorResponse(error);
  }
}
