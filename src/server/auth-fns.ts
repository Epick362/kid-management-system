import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  SESSION_COOKIE,
  createSession,
  deleteSession,
  getSessionFamilyId,
  hashPassword,
  verifyPassword,
  purgeExpiredSessions,
} from "./auth";
import * as schema from "./schema";

/* ──────────────────── shared server-side auth check ──────────────────── */

/**
 * Throws a redirect to /admin/login if no valid session. Returns familyId
 * otherwise. If `installToken` is passed and no session cookie is valid,
 * the token is consumed: a fresh session is minted and the cookie is set,
 * which is how a bookmarked `/admin?install=<token>` URL re-authenticates
 * itself after iOS strips the standalone-PWA cookie jar.
 */
export const requireAdminFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ installToken: z.string().min(8).max(200).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { getDbFromEnv, isProduction } = await import("./env.server");
    const db = getDbFromEnv();
    const sessionToken = getCookie(SESSION_COOKIE);
    let familyId = await getSessionFamilyId(db, sessionToken);

    if (!familyId && data.installToken) {
      const row = await db.query.adminInstallTokens.findFirst({
        where: eq(schema.adminInstallTokens.id, data.installToken),
      });
      if (row) {
        familyId = row.familyId;
        await db
          .update(schema.adminInstallTokens)
          .set({ lastUsedAt: new Date() })
          .where(eq(schema.adminInstallTokens.id, row.id));
        const { id, expiresAt } = await createSession(db, familyId);
        setCookie(SESSION_COOKIE, id, {
          httpOnly: true,
          sameSite: "lax",
          secure: isProduction(),
          path: "/",
          expires: expiresAt,
        });
      }
    }

    if (!familyId) throw redirect({ to: "/admin/login" });
    return { familyId };
  });

/* ──────────────────────────── login & setup ──────────────────────────── */

/** Whether the family has set a password yet. Used by the login page. */
export const getFirstRunStateFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getDbFromEnv } = await import("./env.server");
  const { requireCurrentFamily } = await import("./family.server");
  const db = getDbFromEnv();
  const family = await requireCurrentFamily(db);
  return { firstRun: family.adminPasswordHash === null, familyName: family.name };
});

const loginSchema = z.object({
  password: z.string().min(1).max(200),
});

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => loginSchema.parse(data))
  .handler(async ({ data }) => {
    const { getDbFromEnv, isProduction } = await import("./env.server");
    const { requireCurrentFamily, SINGLE_FAMILY_ID } = await import("./family.server");
    const db = getDbFromEnv();
    const family = await requireCurrentFamily(db);

    // First-run: any non-empty password becomes THE password.
    if (family.adminPasswordHash === null) {
      const hash = await hashPassword(data.password);
      await db
        .update(schema.families)
        .set({ adminPasswordHash: hash })
        .where(eq(schema.families.id, SINGLE_FAMILY_ID));
    } else {
      const ok = await verifyPassword(data.password, family.adminPasswordHash);
      if (!ok) return { ok: false as const, error: "wrongPassword" as const };
    }

    // Opportunistic cleanup of stale sessions.
    await purgeExpiredSessions(db).catch(() => {});

    const { id, expiresAt } = await createSession(db, family.id);
    setCookie(SESSION_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction(),
      path: "/",
      expires: expiresAt,
    });

    throw redirect({ to: "/admin" });
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const { getDbFromEnv, isProduction } = await import("./env.server");
  const token = getCookie(SESSION_COOKIE);
  if (token) await deleteSession(getDbFromEnv(), token);
  setCookie(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: 0,
  });
  throw redirect({ to: "/" });
});
