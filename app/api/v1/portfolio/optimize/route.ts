import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import { optimizePortfolio } from "@/services/portfolio";
import type { RiskProfile } from "@/types/portfolio";

const VALID_PROFILES = new Set<RiskProfile>(["conservative", "moderate", "aggressive"]);

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = req.nextUrl;

    const riskParam = (searchParams.get("risk") ?? "moderate") as RiskProfile;

    if (!VALID_PROFILES.has(riskParam)) {
      return apiError(
        "validation_error",
        "risk must be one of: conservative, moderate, aggressive.",
        400
      );
    }

    const result = await optimizePortfolio(user.id, riskParam);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ApiAuthError)
      return apiError("unauthorized", "Authentication required.", 401);
    console.error(e);
    return apiError("internal_error", "Failed to optimize portfolio.", 500);
  }
}
