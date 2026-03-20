import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import { prisma } from "@/lib/db";

/**
 * POST — save a new push subscription for the current user.
 * Body: { endpoint, keys: { p256dh, auth } }
 *
 * Uses upsert on endpoint so re-subscribing (e.g. after a browser update
 * rotates the endpoint) silently updates rather than creating a duplicate.
 *
 * DELETE — remove the subscription matching the provided endpoint.
 * Body: { endpoint }
 */

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const endpoint = body?.endpoint as string | undefined;
    const p256dh   = body?.keys?.p256dh as string | undefined;
    const auth     = body?.keys?.auth   as string | undefined;

    if (!endpoint || !p256dh || !auth) {
      return apiError("validation_error", "endpoint, keys.p256dh and keys.auth are required.", 400);
    }

    await prisma.pushSubscription.upsert({
      where:  { endpoint },
      update: { userId: user.id, p256dh, auth },
      create: { userId: user.id, endpoint, p256dh, auth },
    });

    return NextResponse.json({ subscribed: true }, { status: 201 });
  } catch (e) {
    if (e instanceof ApiAuthError) return apiError("unauthorized", "Authentication required.", 401);
    console.error(e);
    return apiError("internal_error", "Failed to save subscription.", 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const endpoint = body?.endpoint as string | undefined;

    if (!endpoint) {
      return apiError("validation_error", "endpoint is required.", 400);
    }

    await prisma.pushSubscription
      .deleteMany({ where: { userId: user.id, endpoint } })
      .catch(() => {});

    return NextResponse.json({ unsubscribed: true });
  } catch (e) {
    if (e instanceof ApiAuthError) return apiError("unauthorized", "Authentication required.", 401);
    console.error(e);
    return apiError("internal_error", "Failed to remove subscription.", 500);
  }
}
