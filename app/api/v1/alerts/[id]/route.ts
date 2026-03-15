import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import { markAlertRead, deleteAlert, AlertNotFoundError } from "@/services/alerts";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    await markAlertRead(user.id, id);
    return new NextResponse(null, { status: 200 });
  } catch (e) {
    if (e instanceof ApiAuthError)      return apiError("unauthorized", "Authentication required.", 401);
    if (e instanceof AlertNotFoundError) return apiError("not_found", e.message, 404);
    console.error(e);
    return apiError("internal_error", "Failed to mark alert as read.", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    await deleteAlert(user.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof ApiAuthError)      return apiError("unauthorized", "Authentication required.", 401);
    if (e instanceof AlertNotFoundError) return apiError("not_found", e.message, 404);
    console.error(e);
    return apiError("internal_error", "Failed to dismiss alert.", 500);
  }
}
