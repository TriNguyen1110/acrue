import { auth } from "@/auth";
import { NextResponse } from "next/server";

export interface AuthUser {
  id: string;
  email: string;
}

export class ApiAuthError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "ApiAuthError";
  }
}

/**
 * Extracts the authenticated user from the current NextAuth session.
 * Throws ApiAuthError if no valid session exists.
 *
 * Usage in API routes:
 *   const user = await requireUser();
 */
export async function requireUser(): Promise<AuthUser> {
  const session = await auth();
  if (!session?.user?.id) throw new ApiAuthError();
  return { id: session.user.id, email: session.user.email! };
}

/**
 * Standard error response helper for API routes.
 */
export function apiError(
  code: string,
  message: string,
  status: number
): NextResponse {
  return NextResponse.json({ error: code, message }, { status });
}

/**
 * Wraps an API handler with auth + unified error handling.
 * Catches ApiAuthError → 401, unknown errors → 500.
 */
export function withAuth(
  handler: (user: AuthUser, ...args: unknown[]) => Promise<NextResponse>
) {
  return async (...args: unknown[]) => {
    try {
      const user = await requireUser();
      return await handler(user, ...args);
    } catch (e) {
      if (e instanceof ApiAuthError) {
        return apiError("unauthorized", "Authentication required.", 401);
      }
      console.error(e);
      return apiError("internal_error", "Something went wrong.", 500);
    }
  };
}
