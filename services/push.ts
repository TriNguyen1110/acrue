import webpush from "web-push";
import { prisma } from "@/lib/db";

webpush.setVapidDetails(
  process.env.VAPID_MAILTO    ?? "mailto:admin@acrue.app",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushPayload {
  title: string;
  body:  string;
  url?:  string;
  tag?:  string;
}

export interface PushResult {
  attempted: number;
  succeeded: number;
  errors: string[];
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushResult> {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });

  const result: PushResult = { attempted: subs.length, succeeded: 0, errors: [] };
  if (subs.length === 0) return result;

  await Promise.allSettled(
    subs.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
        result.succeeded++;
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        result.errors.push(`HTTP ${e.statusCode ?? "?"}: ${e.message ?? String(err)}`);
        // 410/404 = subscription revoked — clean it up
        if (e.statusCode === 410 || e.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    })
  );

  return result;
}
