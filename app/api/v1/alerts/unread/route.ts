import { NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import { getUnreadAlerts } from "@/services/alerts";

export async function GET() {
  try {
    const user = await requireUser();
    const result = await getUnreadAlerts(user.id);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ApiAuthError) return apiError("unauthorized", "Authentication required.", 401);
    console.error(e);
    return apiError("internal_error", "Failed to fetch unread alerts.", 500);
  }
}
