import { eq } from "drizzle-orm";
import * as schema from "./schema";
import type { DB } from "./db.server";

/**
 * V1 single-family. We always operate on family id = 1 (seeded in drizzle/seed.sql).
 * If the seed wasn't run, this returns null and callers should show an error.
 */
export const SINGLE_FAMILY_ID = 1;

export async function getCurrentFamily(db: DB) {
  return db.query.families.findFirst({ where: eq(schema.families.id, SINGLE_FAMILY_ID) });
}

export async function requireCurrentFamily(db: DB): Promise<schema.Family> {
  const f = await getCurrentFamily(db);
  if (!f) throw new Error("Family not initialized — run drizzle/seed.sql against the local D1.");
  return f;
}
