import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import { getUserAlertRules, createAlertRule, DuplicateRuleError } from "@/services/alerts";
import type { AlertType } from "@/types";

export async function GET() {
  try {
    const user = await requireUser();
    const rules = await getUserAlertRules(user.id);
    return NextResponse.json(rules);
  } catch (e) {
    if (e instanceof ApiAuthError) return apiError("unauthorized", "Authentication required.", 401);
    console.error(e);
    return apiError("internal_error", "Failed to fetch alert rules.", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const { ticker, ruleType, threshold, cooldownMinutes } = body ?? {};

    if (!ticker || typeof ticker !== "string") {
      return apiError("validation_error", "ticker is required.", 400);
    }
    if (!ruleType || typeof ruleType !== "string") {
      return apiError("validation_error", "ruleType is required.", 400);
    }
    if (threshold === undefined || threshold === null || typeof threshold !== "number") {
      return apiError("validation_error", "threshold must be a number.", 400);
    }
    if (!cooldownMinutes || typeof cooldownMinutes !== "number" || cooldownMinutes < 1) {
      return apiError("validation_error", "cooldownMinutes must be a positive number.", 400);
    }

    const rule = await createAlertRule(user.id, {
      ticker: ticker.trim().toUpperCase(),
      ruleType: ruleType as AlertType,
      threshold,
      cooldownMinutes,
    });
    return NextResponse.json(rule, { status: 201 });
  } catch (e) {
    if (e instanceof ApiAuthError)     return apiError("unauthorized", "Authentication required.", 401);
    if (e instanceof DuplicateRuleError) return apiError("conflict", e.message, 409);
    console.error(e);
    return apiError("internal_error", "Failed to create alert rule.", 500);
  }
}
