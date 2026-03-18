import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import { getSimPortfolios, createSimPortfolio } from "@/services/simulate";
import type { CreateSimPortfolioRequest } from "@/types/simulate";

export async function GET() {
  try {
    const user = await requireUser();
    const sims = await getSimPortfolios(user.id);
    return NextResponse.json(sims);
  } catch (e) {
    if (e instanceof ApiAuthError) return apiError("unauthorized", "Authentication required.", 401);
    console.error(e);
    return apiError("internal_error", "Failed to fetch simulated portfolios.", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json() as CreateSimPortfolioRequest;

    if (!body.name?.trim()) {
      return apiError("validation_error", "name is required.", 400);
    }

    const sim = await createSimPortfolio(user.id, body);
    return NextResponse.json(sim, { status: 201 });
  } catch (e) {
    if (e instanceof ApiAuthError) return apiError("unauthorized", "Authentication required.", 401);
    console.error(e);
    return apiError("internal_error", "Failed to create simulated portfolio.", 500);
  }
}
