/**
 * Server functions for the admin CRUD surfaces (kids, chores, settings).
 * All routes that import these are auth-gated via `requireAdminFn` in beforeLoad,
 * but each mutation re-checks the session as defense in depth.
 *
 * Server-only modules (cloudflare:workers env, drizzle client) are pulled in
 * via dynamic import inside the handler body to keep them out of the client
 * bundle — the framework's import-protection plugin rejects static imports
 * of `.server.*` from any file reachable from a route.
 */
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { SESSION_COOKIE, getSessionFamilyId, hashPassword } from "./auth";
import * as schema from "./schema";
import { choreTypes, kidThemes } from "./schema";

async function authedFamilyIdOrThrow(): Promise<number> {
  const { getDbFromEnv } = await import("./env.server");
  const db = getDbFromEnv();
  const token = getCookie(SESSION_COOKIE);
  const familyId = await getSessionFamilyId(db, token);
  if (!familyId) throw redirect({ to: "/admin/login" });
  return familyId;
}

/* ───────────────────────────── kids ──────────────────────────── */

export const listKidsFn = createServerFn({ method: "GET" }).handler(async () => {
  const familyId = await authedFamilyIdOrThrow();
  const { getDbFromEnv } = await import("./env.server");
  const db = getDbFromEnv();
  const rows = await db.query.kids.findMany({
    where: eq(schema.kids.familyId, familyId),
    orderBy: (k, { asc }) => [asc(k.sortOrder), asc(k.id)],
  });
  return { kids: rows };
});

const kidInputSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1).max(40),
  emoji: z.string().min(1).max(8).default("🙂"),
  color: z.string().min(1).max(20).default("mint"),
  theme: z.enum(kidThemes).default("default"),
  active: z.boolean().default(true),
});

export const upsertKidFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => kidInputSchema.parse(data))
  .handler(async ({ data }) => {
    const familyId = await authedFamilyIdOrThrow();
    const { getDbFromEnv } = await import("./env.server");
    const db = getDbFromEnv();

    if (data.id) {
      await db
        .update(schema.kids)
        .set({
          name: data.name,
          avatarEmoji: data.emoji,
          color: data.color,
          theme: data.theme,
          active: data.active,
        })
        .where(and(eq(schema.kids.id, data.id), eq(schema.kids.familyId, familyId)));
      return { ok: true as const, id: data.id };
    }
    const result = await db
      .insert(schema.kids)
      .values({
        familyId,
        name: data.name,
        avatarEmoji: data.emoji,
        color: data.color,
        theme: data.theme,
        active: data.active,
        sortOrder: 0,
      })
      .returning({ id: schema.kids.id });
    return { ok: true as const, id: result[0]!.id };
  });

export const deleteKidFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.number().int().positive() }).parse(data))
  .handler(async ({ data }) => {
    const familyId = await authedFamilyIdOrThrow();
    const { getDbFromEnv } = await import("./env.server");
    const db = getDbFromEnv();
    // Soft delete — keeps history intact.
    await db
      .update(schema.kids)
      .set({ active: false })
      .where(and(eq(schema.kids.id, data.id), eq(schema.kids.familyId, familyId)));
    return { ok: true as const };
  });

/* ──────────────────────────── chores ─────────────────────────── */

export const listChoresFn = createServerFn({ method: "GET" }).handler(async () => {
  const familyId = await authedFamilyIdOrThrow();
  const { getDbFromEnv } = await import("./env.server");
  const db = getDbFromEnv();
  const rows = await db.query.chores.findMany({
    where: eq(schema.chores.familyId, familyId),
    orderBy: (c, { asc }) => [asc(c.sortOrder), asc(c.id)],
  });
  return { chores: rows };
});

const choreInputSchema = z
  .object({
    id: z.number().int().positive().optional(),
    name: z.string().min(1).max(80),
    icon: z.string().min(1).max(8).default("✨"),
    type: z.enum(choreTypes),
    rewardMinutes: z.number().int().min(0).max(600).default(0),
    bonusMin: z.number().int().min(0).max(600).nullable().default(null),
    bonusMax: z.number().int().min(0).max(600).nullable().default(null),
    maxPerDay: z.number().int().min(1).max(20).nullable().default(null),
    maxPerWeek: z.number().int().min(1).max(50).nullable().default(null),
    requiredForPlay: z.boolean().default(false),
    active: z.boolean().default(true),
  })
  .refine(
    (v) =>
      v.type !== "earning_weekly_quest" ||
      (v.bonusMin !== null && v.bonusMax !== null && v.bonusMin <= v.bonusMax),
    {
      message: "Weekly quest needs valid bonusMin ≤ bonusMax",
      path: ["bonusMin"],
    },
  );

export const upsertChoreFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => choreInputSchema.parse(data))
  .handler(async ({ data }) => {
    const familyId = await authedFamilyIdOrThrow();
    const { getDbFromEnv } = await import("./env.server");
    const db = getDbFromEnv();

    // family_duty chores must have 0 reward (enforced server-side regardless of client input)
    const reward = data.type === "family_duty" ? 0 : data.rewardMinutes;
    // required_for_play is only meaningful for family_duty
    const required = data.type === "family_duty" ? data.requiredForPlay : false;

    if (data.id) {
      await db
        .update(schema.chores)
        .set({
          name: data.name,
          icon: data.icon,
          type: data.type,
          rewardMinutes: reward,
          bonusMin: data.bonusMin,
          bonusMax: data.bonusMax,
          maxPerDay: data.maxPerDay,
          maxPerWeek: data.maxPerWeek,
          requiredForPlay: required,
          active: data.active,
        })
        .where(and(eq(schema.chores.id, data.id), eq(schema.chores.familyId, familyId)));
      return { ok: true as const, id: data.id };
    }
    const result = await db
      .insert(schema.chores)
      .values({
        familyId,
        name: data.name,
        icon: data.icon,
        type: data.type,
        rewardMinutes: reward,
        bonusMin: data.bonusMin,
        bonusMax: data.bonusMax,
        maxPerDay: data.maxPerDay,
        maxPerWeek: data.maxPerWeek,
        requiredForPlay: required,
        active: data.active,
        sortOrder: 100,
      })
      .returning({ id: schema.chores.id });
    return { ok: true as const, id: result[0]!.id };
  });

export const deleteChoreFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.number().int().positive() }).parse(data))
  .handler(async ({ data }) => {
    const familyId = await authedFamilyIdOrThrow();
    const { getDbFromEnv } = await import("./env.server");
    const db = getDbFromEnv();
    await db
      .update(schema.chores)
      .set({ active: false })
      .where(and(eq(schema.chores.id, data.id), eq(schema.chores.familyId, familyId)));
    return { ok: true as const };
  });

/* ──────────────────────────── settings ─────────────────────────── */

export const getSettingsFn = createServerFn({ method: "GET" }).handler(async () => {
  const familyId = await authedFamilyIdOrThrow();
  const { getDbFromEnv } = await import("./env.server");
  const db = getDbFromEnv();
  const f = await db.query.families.findFirst({ where: eq(schema.families.id, familyId) });
  if (!f) throw new Error("Family not found");
  return {
    name: f.name,
    dailyCapMinutes: f.dailyCapMinutes,
    bankCapMinutes: f.bankCapMinutes,
    defaultChoreMinutes: f.defaultChoreMinutes,
  };
});

const settingsSchema = z.object({
  name: z.string().min(1).max(60),
  dailyCapMinutes: z.number().int().min(0).max(1440),
  bankCapMinutes: z.number().int().min(0).max(10_000),
  defaultChoreMinutes: z.number().int().min(0).max(600),
});

export const updateSettingsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => settingsSchema.parse(data))
  .handler(async ({ data }) => {
    const familyId = await authedFamilyIdOrThrow();
    const { getDbFromEnv } = await import("./env.server");
    const db = getDbFromEnv();
    await db
      .update(schema.families)
      .set({
        name: data.name,
        dailyCapMinutes: data.dailyCapMinutes,
        bankCapMinutes: data.bankCapMinutes,
        defaultChoreMinutes: data.defaultChoreMinutes,
      })
      .where(eq(schema.families.id, familyId));
    return { ok: true as const };
  });

export const changePasswordFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ password: z.string().min(4).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const familyId = await authedFamilyIdOrThrow();
    const { getDbFromEnv } = await import("./env.server");
    const db = getDbFromEnv();
    const hash = await hashPassword(data.password);
    await db
      .update(schema.families)
      .set({ adminPasswordHash: hash })
      .where(eq(schema.families.id, familyId));
    return { ok: true as const };
  });
