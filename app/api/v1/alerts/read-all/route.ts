import { NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import { markAllAlertsRead } from "@/services/alerts";

export async function PATCH() {
  try {
    const user = await requireUser();
    await markAllAlertsRead(user.id);
    return new NextResponse(null, { status: 200 });
  } catch (e) {
    if (e instanceof ApiAuthError) return apiError("unauthorized", "Authentication required.", 401);
    console.error(e);
    return apiError("internal_error", "Failed to mark alerts as read.", 500);
  }
}
