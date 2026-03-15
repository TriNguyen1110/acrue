import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import { getUserAlerts } from "@/services/alerts";
import type { AlertType, AlertSeverity } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = req.nextUrl;

    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

    const typeParam     = searchParams.get("type");
    const severityParam = searchParams.get("severity");

    const filters = {
      ...(typeParam     ? { type:     typeParam     as AlertType }     : {}),
      ...(severityParam ? { severity: severityParam as AlertSeverity } : {}),
    };

    const result = await getUserAlerts(user.id, page, limit, filters);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ApiAuthError) return apiError("unauthorized", "Authentication required.", 401);
    console.error(e);
    return apiError("internal_error", "Failed to fetch alerts.", 500);
  }
}
