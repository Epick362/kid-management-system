import { eq, lt } from "drizzle-orm";
import * as schema from "./schema";
import type { DB } from "./db.server";

/* ─────────────────────────── password hashing ───────────────────────────
 * PBKDF2-SHA256 via Web Crypto (works in Workers and Node 22+).
 * Format: pbkdf2$<iterations>$<saltHex>$<hashHex>
 * ─────────────────────────────────────────────────────────────────────── */

const PBKDF2_ITER = 100_000;
const PBKDF2_KEY_BITS = 256;
const SALT_BYTES = 16;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function deriveHash(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    PBKDF2_KEY_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveHash(password, salt, PBKDF2_ITER);
  return `pbkdf2$${PBKDF2_ITER}$${toHex(salt)}$${toHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iter = parseInt(parts[1]!, 10);
  if (!Number.isFinite(iter) || iter < 10_000) return false;
  const salt = fromHex(parts[2]!);
  const expected = parts[3]!;
  const actual = toHex(await deriveHash(password, salt, iter));
  return timingSafeEqual(actual, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ─────────────────────────── sessions ──────────────────────────────── */

const SESSION_TTL_DAYS = 30;
export const SESSION_COOKIE = "kms_session";

export async function createSession(db: DB, familyId: number): Promise<{ id: string; expiresAt: Date }> {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await db.insert(schema.adminSessions).values({ id, familyId, expiresAt });
  return { id, expiresAt };
}

export async function getSessionFamilyId(db: DB, sessionId: string | null | undefined): Promise<number | null> {
  if (!sessionId) return null;
  const row = await db.query.adminSessions.findFirst({
    where: eq(schema.adminSessions.id, sessionId),
  });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(schema.adminSessions).where(eq(schema.adminSessions.id, sessionId));
    return null;
  }
  return row.familyId;
}

export async function deleteSession(db: DB, sessionId: string): Promise<void> {
  await db.delete(schema.adminSessions).where(eq(schema.adminSessions.id, sessionId));
}

/** Best-effort purge of expired sessions. Called opportunistically. */
export async function purgeExpiredSessions(db: DB): Promise<void> {
  await db.delete(schema.adminSessions).where(lt(schema.adminSessions.expiresAt, new Date()));
}

/* ─────────────────────────── cookie helpers ──────────────────────────── */

export function buildSessionCookie(token: string, isProduction: boolean): string {
  const flags = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_DAYS * 86_400}`,
  ];
  if (isProduction) flags.push("Secure");
  return flags.join("; ");
}

export function buildClearSessionCookie(isProduction: boolean): string {
  const flags = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (isProduction) flags.push("Secure");
  return flags.join("; ");
}

export function parseSessionFromCookieHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}
