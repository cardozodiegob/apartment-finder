import { NextRequest } from "next/server";
import { getPaymentSummary } from "@/lib/services/payments";
import type { SupportedCurrency, SupportedLocale } from "@/lib/services/currency";
import { errorResponse } from "@/lib/api/errors";
import { requireSessionUser } from "@/lib/api/session";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSessionUser();
    const { id } = await params;
    const url = new URL(request.url);
    const userCurrency = (url.searchParams.get("currency") || undefined) as SupportedCurrency | undefined;
    const locale = (url.searchParams.get("locale") || "en") as SupportedLocale;
    const { summary, error } = await getPaymentSummary(id, userCurrency, locale);
    if (error) return Response.json({ error }, { status: 404 });
    return Response.json(summary);
  } catch (error) {
    return errorResponse(error);
  }
}
