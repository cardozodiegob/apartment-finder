import { NextRequest } from "next/server";
import { requireSessionUser } from "@/lib/api/session";
import dbConnect from "@/lib/db/connection";
import Message from "@/lib/db/models/Message";
import MessageTranslation from "@/lib/db/models/MessageTranslation";
import { errorResponse, ApiErrorResponse } from "@/lib/api/errors";

/**
 * POST /api/messages/translate
 * Body: { messageId: string, targetLanguage: string }
 *
 * Returns a translation for the given message, using a cached value when
 * available. The translation provider is stubbed — it returns the source
 * body with a "[<lang>]" prefix when no `LIBRETRANSLATE_URL` env var is
 * configured, so the UI path is testable without third-party keys.
 */
async function providerTranslate(body: string, target: string): Promise<string> {
  const url = process.env.LIBRETRANSLATE_URL;
  if (!url) return `[${target}] ${body}`;
  try {
    const res = await fetch(`${url}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: body, source: "auto", target, format: "text" }),
    });
    if (!res.ok) return `[${target}] ${body}`;
    const data = (await res.json()) as { translatedText?: string };
    return data.translatedText ?? body;
  } catch {
    return `[${target}] ${body}`;
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSessionUser();
    await dbConnect();

    const { messageId, targetLanguage } = (await req.json()) as {
      messageId?: string;
      targetLanguage?: string;
    };

    if (!messageId || !targetLanguage) {
      throw new ApiErrorResponse("VALIDATION_ERROR", "messageId and targetLanguage are required", 400);
    }

    // Cache hit?
    const cached = await MessageTranslation.findOne({ messageId, targetLanguage });
    if (cached) {
      return Response.json({ translatedBody: cached.translatedBody, cached: true });
    }

    const message = await Message.findById(messageId).lean<{ body?: string }>();
    if (!message?.body) {
      throw new ApiErrorResponse("NOT_FOUND", "Message not found", 404);
    }

    const translated = await providerTranslate(message.body, targetLanguage);

    await MessageTranslation.create({
      messageId,
      targetLanguage,
      translatedBody: translated,
      provider: process.env.LIBRETRANSLATE_URL ? "libretranslate" : "stub",
    });

    return Response.json({ translatedBody: translated, cached: false });
  } catch (error) {
    return errorResponse(error);
  }
}
