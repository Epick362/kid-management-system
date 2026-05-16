import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * Returns a Drizzle client bound to the request's D1 database.
 * Call from server functions / route loaders / actions.
 */
export function getDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type DB = ReturnType<typeof getDb>;
export { schema };
