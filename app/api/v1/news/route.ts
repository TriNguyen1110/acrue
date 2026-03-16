import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import { getNewsForUser } from "@/services/news";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = req.nextUrl;

    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

    const ticker    = searchParams.get("ticker")    ?? undefined;
    const topic     = searchParams.get("topic")     ?? undefined;
    const sentiment = searchParams.get("sentiment") ?? undefined;

    const { articles, total } = await getNewsForUser(user.id, {
      ticker,
      topic,
      sentiment,
      page,
      limit,
    });

    return NextResponse.json({ articles, total, page, limit });
  } catch (e) {
    if (e instanceof ApiAuthError) return apiError("unauthorized", "Authentication required.", 401);
    console.error(e);
    return apiError("internal_error", "Failed to fetch news.", 500);
  }
}
