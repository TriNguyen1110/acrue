import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import {
  addSimHolding,
  SimPortfolioNotFoundError,
  SimHoldingExistsError,
  TickerNotFoundError,
} from "@/services/simulate";
import type { AddSimHoldingRequest } from "@/types/simulate";

interface Ctx { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json() as AddSimHoldingRequest;

    if (!body.ticker?.trim()) return apiError("validation_error", "ticker is required.", 400);
    if (typeof body.shares !== "number" || body.shares <= 0) {
      return apiError("validation_error", "shares must be a positive number.", 400);
    }

    const holding = await addSimHolding(user.id, id, body);
    return NextResponse.json(holding, { status: 201 });
  } catch (e) {
    if (e instanceof ApiAuthError)            return apiError("unauthorized",    "Authentication required.", 401);
    if (e instanceof SimPortfolioNotFoundError) return apiError("not_found",      e.message, 404);
    if (e instanceof SimHoldingExistsError)   return apiError("duplicate",       e.message, 409);
    if (e instanceof TickerNotFoundError)     return apiError("ticker_not_found", e.message, 404);
    console.error(e);
    return apiError("internal_error", "Failed to add holding.", 500);
  }
}
