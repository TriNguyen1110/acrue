import { NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import { getSignalsForUser } from "@/services/signals";

export async function GET() {
  try {
    const user   = await requireUser();
    const scores = await getSignalsForUser(user.id);
    return NextResponse.json({ scores });
  } catch (e) {
    if (e instanceof ApiAuthError) return apiError("unauthorized", "Authentication required.", 401);
    console.error("[signals] GET error:", e);
    return apiError("internal_error", "Failed to compute signals.", 500);
  }
}
