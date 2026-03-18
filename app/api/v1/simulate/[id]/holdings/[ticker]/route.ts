import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import {
  removeSimHolding,
  SimPortfolioNotFoundError,
  SimHoldingNotFoundError,
} from "@/services/simulate";

interface Ctx { params: Promise<{ id: string; ticker: string }> }

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id, ticker } = await ctx.params;
    await removeSimHolding(user.id, id, ticker);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ApiAuthError)              return apiError("unauthorized", "Authentication required.", 401);
    if (e instanceof SimPortfolioNotFoundError) return apiError("not_found",   e.message, 404);
    if (e instanceof SimHoldingNotFoundError)   return apiError("not_found",   e.message, 404);
    console.error(e);
    return apiError("internal_error", "Failed to remove holding.", 500);
  }
}
