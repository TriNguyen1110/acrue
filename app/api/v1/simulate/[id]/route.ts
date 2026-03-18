import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import { getSimPortfolio, deleteSimPortfolio, SimPortfolioNotFoundError } from "@/services/simulate";

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const sim = await getSimPortfolio(user.id, id);
    return NextResponse.json(sim);
  } catch (e) {
    if (e instanceof ApiAuthError) return apiError("unauthorized", "Authentication required.", 401);
    if (e instanceof SimPortfolioNotFoundError) return apiError("not_found", e.message, 404);
    console.error(e);
    return apiError("internal_error", "Failed to fetch simulated portfolio.", 500);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    await deleteSimPortfolio(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ApiAuthError) return apiError("unauthorized", "Authentication required.", 401);
    if (e instanceof SimPortfolioNotFoundError) return apiError("not_found", e.message, 404);
    console.error(e);
    return apiError("internal_error", "Failed to delete simulated portfolio.", 500);
  }
}
