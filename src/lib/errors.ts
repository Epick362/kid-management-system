/**
 * Best-effort extraction of a human-readable message from any thrown value.
 * Server-fn errors arrive as plain Error instances; D1 errors come wrapped
 * with the message inside `.message`. Zod parse failures also expose `.message`.
 * Anything else falls back to the caller-provided default.
 */
export function getErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "string" && e.length > 0) return e;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return fallback;
}
