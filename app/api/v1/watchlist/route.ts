import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import {
  getUserWatchlist,
  addToWatchlist,
  TickerNotFoundError,
  DuplicateTickerError,
} from "@/services/watchlist";

export async function GET() {
  try {
    const user = await requireUser();
    const watchlist = await getUserWatchlist(user.id);
    return NextResponse.json(watchlist);
  } catch (e) {
    if (e instanceof ApiAuthError) return apiError("unauthorized", "Authentication required.", 401);
    console.error(e);
    return apiError("internal_error", "Failed to fetch watchlist.", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const ticker = body?.ticker?.trim()?.toUpperCase();

    if (!ticker) {
      return apiError("validation_error", "ticker is required.", 400);
    }

    const entry = await addToWatchlist(user.id, ticker);
    return NextResponse.json(entry, { status: 201 });
  } catch (e) {
    if (e instanceof ApiAuthError) return apiError("unauthorized", "Authentication required.", 401);
    if (e instanceof TickerNotFoundError) return apiError("not_found", e.message, 404);
    if (e instanceof DuplicateTickerError) return apiError("conflict", e.message, 409);
    console.error(e);
    return apiError("internal_error", "Failed to add ticker.", 500);
  }
}
