import { NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import { getAlertFilterOptions } from "@/services/alerts";

export async function GET() {
  try {
    const user    = await requireUser();
    const options = await getAlertFilterOptions(user.id);
    return NextResponse.json(options);
  } catch (e) {
    if (e instanceof ApiAuthError) return apiError("unauthorized", "Authentication required.", 401);
    console.error(e);
    return apiError("internal_error", "Failed to fetch filter options.", 500);
  }
}
