import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import { updateAlertRule, deleteAlertRule, RuleNotFoundError } from "@/services/alerts";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json();

    const update: { threshold?: number; cooldownMinutes?: number } = {};

    if (body?.threshold !== undefined) {
      if (typeof body.threshold !== "number") {
        return apiError("validation_error", "threshold must be a number.", 400);
      }
      update.threshold = body.threshold;
    }

    if (body?.cooldownMinutes !== undefined) {
      if (typeof body.cooldownMinutes !== "number" || body.cooldownMinutes < 1) {
        return apiError("validation_error", "cooldownMinutes must be a positive number.", 400);
      }
      update.cooldownMinutes = body.cooldownMinutes;
    }

    if (Object.keys(update).length === 0) {
      return apiError("validation_error", "At least one of threshold or cooldownMinutes is required.", 400);
    }

    await updateAlertRule(user.id, id, update);
    return new NextResponse(null, { status: 200 });
  } catch (e) {
    if (e instanceof ApiAuthError)    return apiError("unauthorized", "Authentication required.", 401);
    if (e instanceof RuleNotFoundError) return apiError("not_found", e.message, 404);
    console.error(e);
    return apiError("internal_error", "Failed to update alert rule.", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    await deleteAlertRule(user.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof ApiAuthError)    return apiError("unauthorized", "Authentication required.", 401);
    if (e instanceof RuleNotFoundError) return apiError("not_found", e.message, 404);
    console.error(e);
    return apiError("internal_error", "Failed to delete alert rule.", 500);
  }
}
