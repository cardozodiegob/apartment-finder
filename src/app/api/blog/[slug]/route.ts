import { NextRequest } from "next/server";
import dbConnect from "@/lib/db/connection";
import BlogArticle from "@/lib/db/models/BlogArticle";
import { requireAdmin } from "@/lib/api/session";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    await dbConnect();
    const article = await BlogArticle.findOne({ slug, isPublished: true }).lean();
    if (!article) throw new ApiErrorResponse("NOT_FOUND", "Article not found", 404);

    // Related articles: same category, exclude current, limit 3
    const related = await BlogArticle.find({
      category: article.category,
      isPublished: true,
      _id: { $ne: article._id },
    })
      .sort({ publishedAt: -1 })
      .limit(3)
      .lean();

    return Response.json({ article, related });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    await requireAdmin();
    await dbConnect();
    const body = await request.json();

    // If publishing for the first time, set publishedAt
    if (body.isPublished) {
      const existing = await BlogArticle.findOne({ slug });
      if (existing && !existing.publishedAt) {
        body.publishedAt = new Date();
      }
    }

    const article = await BlogArticle.findOneAndUpdate(
      { slug },
      body,
      { new: true, runValidators: true }
    );
    if (!article) throw new ApiErrorResponse("NOT_FOUND", "Article not found", 404);
    return Response.json({ article });
  } catch (error) {
    return errorResponse(error);
  }
}
