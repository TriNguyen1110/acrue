import { NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import { sendPushToUser } from "@/services/push";
import { prisma } from "@/lib/db";

export async function POST() {
  try {
    const user = await requireUser();

    const subCount = await prisma.pushSubscription.count({ where: { userId: user.id } });

    if (subCount === 0) {
      return NextResponse.json({
        sent: false,
        error: "no_subscription",
        message: "No push subscription found for your account. Make sure you clicked 'Enable push alerts' and granted permission.",
      }, { status: 200 });
    }

    const result = await sendPushToUser(user.id, {
      title: "⚠ AAPL — High Alert",
      body:  "AAPL moved +5.2% — price change threshold exceeded.",
      url:   "/alerts",
      tag:   "acrue-test",
    });

    return NextResponse.json({
      sent:      result.succeeded > 0,
      attempted: result.attempted,
      succeeded: result.succeeded,
      errors:    result.errors,
    });
  } catch (e) {
    if (e instanceof ApiAuthError) return apiError("unauthorized", "Authentication required.", 401);
    console.error(e);
    return apiError("internal_error", "Failed to send test notification.", 500);
  }
}
