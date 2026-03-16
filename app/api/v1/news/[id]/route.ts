import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import { getArticle, markAsRead, ArticleNotFoundError } from "@/services/news";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;

    const article = await getArticle(id);
    if (!article) throw new ArticleNotFoundError(id);

    return NextResponse.json(article);
  } catch (e) {
    if (e instanceof ApiAuthError)         return apiError("unauthorized", "Authentication required.", 401);
    if (e instanceof ArticleNotFoundError) return apiError("not_found", e.message, 404);
    console.error(e);
    return apiError("internal_error", "Failed to fetch article.", 500);
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    await markAsRead(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ApiAuthError) return apiError("unauthorized", "Authentication required.", 401);
    console.error(e);
    return apiError("internal_error", "Failed to mark article as read.", 500);
  }
}
