import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import {
  updateHolding,
  removeHolding,
  HoldingNotFoundError,
} from "@/services/portfolio";

interface RouteContext {
  params: Promise<{ ticker: string }>;
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { ticker } = await ctx.params;
    const body = await req.json();

    const updates = body as { shares?: number; avgCost?: number };

    if (
      updates.shares !== undefined &&
      (typeof updates.shares !== "number" || updates.shares <= 0)
    ) {
      return apiError("validation_error", "shares must be a positive number.", 400);
    }

    if (
      updates.avgCost !== undefined &&
      (typeof updates.avgCost !== "number" || updates.avgCost <= 0)
    ) {
      return apiError("validation_error", "avgCost must be a positive number.", 400);
    }

    await updateHolding(user.id, ticker, updates);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ApiAuthError)
      return apiError("unauthorized", "Authentication required.", 401);
    if (e instanceof HoldingNotFoundError)
      return apiError("not_found", e.message, 404);
    console.error(e);
    return apiError("internal_error", "Failed to update holding.", 500);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { ticker } = await ctx.params;
    await removeHolding(user.id, ticker);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ApiAuthError)
      return apiError("unauthorized", "Authentication required.", 401);
    if (e instanceof HoldingNotFoundError)
      return apiError("not_found", e.message, 404);
    console.error(e);
    return apiError("internal_error", "Failed to remove holding.", 500);
  }
}
