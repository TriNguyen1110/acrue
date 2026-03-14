import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import { getQuote } from "@/lib/finnhub";
import { getAssetSummary } from "@/lib/finnhub";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    await requireUser();
    const { ticker } = await params;
    const upper = ticker.toUpperCase();

    const [quote, summary] = await Promise.all([
      getQuote(upper, "high"),
      getAssetSummary(upper),
    ]);

    if (quote.price === 0 && quote.previousClose === 0) {
      return apiError("not_found", `Ticker ${upper} not found.`, 404);
    }

    return NextResponse.json({ quote, summary });
  } catch (e) {
    if (e instanceof ApiAuthError) return apiError("unauthorized", "Authentication required.", 401);
    console.error(e);
    return apiError("internal_error", "Failed to fetch asset.", 500);
  }
}
