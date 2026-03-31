import { NextRequest } from "next/server";
import { getRates, SUPPORTED_CURRENCIES } from "@/lib/services/currency";
import type { SupportedCurrency } from "@/lib/services/currency";
import { errorResponse } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const base = (url.searchParams.get("base") || "EUR").toUpperCase() as SupportedCurrency;

    if (!SUPPORTED_CURRENCIES.includes(base)) {
      return Response.json({ error: "Unsupported currency" }, { status: 400 });
    }

    const rates = await getRates(base);
    return Response.json(rates);
  } catch (error) {
    return errorResponse(error);
  }
}
