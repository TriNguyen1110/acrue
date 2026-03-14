import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import { searchAssets } from "@/services/search";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (!q) return NextResponse.json([]);

    const results = await searchAssets(q, user.id);
    return NextResponse.json(results);
  } catch (e) {
    if (e instanceof ApiAuthError) return apiError("unauthorized", "Authentication required.", 401);
    console.error(e);
    return apiError("internal_error", "Search failed.", 500);
  }
}
