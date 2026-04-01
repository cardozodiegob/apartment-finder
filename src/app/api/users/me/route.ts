import { NextRequest } from "next/server";
import dbConnect from "@/lib/db/connection";
import User from "@/lib/db/models/User";
import { requireSessionUser } from "@/lib/api/session";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";
import { validateIdNumber } from "@/lib/validations/identity";

const REQUIRED_FIELDS = ["fullName", "phone", "dateOfBirth", "nationality", "idType", "idNumber"] as const;

function calcProfileCompleteness(user: Record<string, unknown>): number {
  const filled = REQUIRED_FIELDS.filter((f) => {
    const val = user[f];
    return val !== undefined && val !== null && val !== "";
  }).length;
  return filled / REQUIRED_FIELDS.length;
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireSessionUser();
    await dbConnect();
    const body = await request.json();

    const allowedFields = [
      "fullName", "bio", "phone", "dateOfBirth", "nationality", "idType", "idNumber",
    ];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "No valid fields to update", 400);
    }

    // Validate ID number if both idType and idNumber are provided
    const idType = (updates.idType as string) || undefined;
    const idNumber = (updates.idNumber as string) || undefined;
    const nationality = (updates.nationality as string) || undefined;

    if (idType && idNumber && nationality) {
      const validation = validateIdNumber(idType, idNumber, nationality);
      if (!validation.valid) {
        throw new ApiErrorResponse("VALIDATION_ERROR", validation.error || "Invalid ID number", 400);
      }
    }

    const user = await User.findById(session.mongoId);
    if (!user) {
      throw new ApiErrorResponse("NOT_FOUND", "User not found", 404);
    }

    // Apply updates
    for (const [key, value] of Object.entries(updates)) {
      user.set(key, value);
    }

    // Recalculate profile completeness
    const userObj = user.toObject() as unknown as Record<string, unknown>;
    const completeness = calcProfileCompleteness(userObj);
    user.profileCompleteness = completeness;
    user.profileCompleted = completeness >= 1;

    await user.save();

    return Response.json({
      user: {
        _id: user._id,
        fullName: user.fullName,
        bio: user.bio,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        nationality: user.nationality,
        idType: user.idType,
        idNumber: user.idNumber,
        profilePhoto: user.profilePhoto,
        profileCompleteness: user.profileCompleteness,
        profileCompleted: user.profileCompleted,
        idVerified: user.idVerified,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
