import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import {
  getPortfolio,
  addHolding,
  DuplicateHoldingError,
  TickerNotFoundError,
} from "@/services/portfolio";

export async function GET() {
  try {
    const user = await requireUser();
    const portfolio = await getPortfolio(user.id);
    return NextResponse.json(portfolio);
  } catch (e) {
    if (e instanceof ApiAuthError)
      return apiError("unauthorized", "Authentication required.", 401);
    console.error(e);
    return apiError("internal_error", "Failed to fetch portfolio.", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const { ticker, shares, avgCost } = body as {
      ticker: string;
      shares: number;
      avgCost: number;
    };

    if (!ticker || typeof shares !== "number" || typeof avgCost !== "number") {
      return apiError(
        "validation_error",
        "ticker, shares, and avgCost are required.",
        400
      );
    }

    if (shares <= 0 || avgCost <= 0) {
      return apiError(
        "validation_error",
        "shares and avgCost must be positive.",
        400
      );
    }

    const holding = await addHolding(user.id, { ticker, shares, avgCost });
    return NextResponse.json(holding, { status: 201 });
  } catch (e) {
    if (e instanceof ApiAuthError)
      return apiError("unauthorized", "Authentication required.", 401);
    if (e instanceof DuplicateHoldingError)
      return apiError("duplicate_holding", e.message, 409);
    if (e instanceof TickerNotFoundError)
      return apiError("ticker_not_found", e.message, 404);
    console.error(e);
    return apiError("internal_error", "Failed to add holding.", 500);
  }
}
