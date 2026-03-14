import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import { removeFromWatchlist, TickerNotFoundError } from "@/services/watchlist";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const user = await requireUser();
    const { ticker } = await params;

    await removeFromWatchlist(user.id, ticker.toUpperCase());
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof ApiAuthError) return apiError("unauthorized", "Authentication required.", 401);
    if (e instanceof TickerNotFoundError) return apiError("not_found", e.message, 404);
    console.error(e);
    return apiError("internal_error", "Failed to remove ticker.", 500);
  }
}
