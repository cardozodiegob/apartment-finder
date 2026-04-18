import { NextRequest } from "next/server";
import dbConnect from "@/lib/db/connection";
import BlogArticle from "@/lib/db/models/BlogArticle";
import { requireAdmin } from "@/lib/api/session";
import { errorResponse } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "12")));
    const category = searchParams.get("category");

    const filter: Record<string, unknown> = { isPublished: true };
    if (category) filter.category = category;

    const [articles, totalCount] = await Promise.all([
      BlogArticle.find(filter)
        .sort({ publishedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      BlogArticle.countDocuments(filter),
    ]);

    return Response.json({
      articles,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    await dbConnect();
    const body = await request.json();

    const article = await BlogArticle.create({
      ...body,
      authorId: admin.mongoId,
      publishedAt: body.isPublished ? new Date() : undefined,
    });

    return Response.json({ article }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
