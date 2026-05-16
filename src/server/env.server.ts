import { env } from "cloudflare:workers";
import { getDb } from "./db.server";

/** Returns the Cloudflare env bindings (D1, secrets, etc) for this request. */
export function getCfEnv() {
  return env;
}

/** Drizzle client bound to the request's D1. */
export function getDbFromEnv() {
  return getDb(env.DB);
}

/** Best-effort: are we serving over HTTPS / production? */
export function isProduction(): boolean {
  return !import.meta.env.DEV;
}
