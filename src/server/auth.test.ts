import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  buildSessionCookie,
  buildClearSessionCookie,
  parseSessionFromCookieHeader,
} from "./auth";

describe("password hashing", () => {
  it("round-trips a correct password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("hunter2");
    expect(await verifyPassword("hunter3", hash)).toBe(false);
  });

  it("produces distinct hashes for the same password (random salt)", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same", a)).toBe(true);
    expect(await verifyPassword("same", b)).toBe(true);
  });

  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$10$...")).toBe(false);
    expect(await verifyPassword("x", "pbkdf2$100000$xx$yy")).toBe(false);
  });
});

describe("session cookie helpers", () => {
  it("includes Secure only in production", () => {
    expect(buildSessionCookie("abc", true)).toContain("Secure");
    expect(buildSessionCookie("abc", false)).not.toContain("Secure");
  });

  it("clear cookie has Max-Age=0", () => {
    expect(buildClearSessionCookie(true)).toContain("Max-Age=0");
  });

  it("parses the session token from a cookie header", () => {
    expect(parseSessionFromCookieHeader("kms_session=tok123")).toBe("tok123");
    expect(parseSessionFromCookieHeader("foo=bar; kms_session=tok123; baz=qux")).toBe("tok123");
    expect(parseSessionFromCookieHeader("other=value")).toBe(null);
    expect(parseSessionFromCookieHeader(null)).toBe(null);
    expect(parseSessionFromCookieHeader(undefined)).toBe(null);
  });
});
