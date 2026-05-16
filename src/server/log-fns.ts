/**
 * Server functions for the parent's daily logging surface and the
 * "Today" overview on /admin.
 */
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import { SESSION_COOKIE, getSessionFamilyId } from "./auth";
import * as schema from "./schema";
import { dayKey } from "../lib/dates";
import {
  computeAvailableToday,
  computeBankBalance,
  computeDailyUsed,
  rollQuestBonus,
  type BankEvent,
} from "./screen-time";

async function authedFamilyIdOrThrow(): Promise<number> {
  const { getDbFromEnv } = await import("./env.server");
  const db = getDbFromEnv();
  const token = getCookie(SESSION_COOKIE);
  const familyId = await getSessionFamilyId(db, token);
  if (!familyId) throw redirect({ to: "/admin/login" });
  return familyId;
}

/* Load all bank-affecting events for a kid (full history). For tiny data we
 * just read everything; if this ever gets big we'll add date ranges. */
async function loadEvents(kidId: number): Promise<BankEvent[]> {
  const { getDbFromEnv } = await import("./env.server");
  const db = getDbFromEnv();
  const [completions, usage, adjustments] = await Promise.all([
    db.query.choreCompletions.findMany({
      where: eq(schema.choreCompletions.kidId, kidId),
    }),
    db.query.screenTimeEntries.findMany({
      where: eq(schema.screenTimeEntries.kidId, kidId),
    }),
    db.query.balanceAdjustments.findMany({
      where: eq(schema.balanceAdjustments.kidId, kidId),
    }),
  ]);
  const events: BankEvent[] = [];
  for (const c of completions) {
    if (c.minutesAwarded > 0) events.push({ kind: "award", at: c.completedAt, minutes: c.minutesAwarded });
  }
  for (const u of usage) events.push({ kind: "used", at: u.usedAt, minutes: u.minutes });
  for (const a of adjustments) events.push({ kind: "adjustment", at: a.createdAt, minutes: a.minutes });
  return events;
}

/* ───────────────────── today overview (multi-kid) ───────────────────── */

export const getTodayOverviewFn = createServerFn({ method: "GET" }).handler(async () => {
  const familyId = await authedFamilyIdOrThrow();
  const { getDbFromEnv } = await import("./env.server");
  const db = getDbFromEnv();

  const family = await db.query.families.findFirst({ where: eq(schema.families.id, familyId) });
  if (!family) throw new Error("Family not found");

  const kids = await db.query.kids.findMany({
    where: and(eq(schema.kids.familyId, familyId), eq(schema.kids.active, true)),
    orderBy: (k, { asc }) => [asc(k.sortOrder), asc(k.id)],
  });

  const now = new Date();
  const today = dayKey(now);

  const perKid = await Promise.all(
    kids.map(async (kid) => {
      const events = await loadEvents(kid.id);
      const { balance } = computeBankBalance(events, family.bankCapMinutes, now);
      const usedToday = computeDailyUsed(events, now);
      const available = computeAvailableToday({
        events,
        bankCapMinutes: family.bankCapMinutes,
        dailyCapMinutes: family.dailyCapMinutes,
        now,
      });

      // Count today's completions
      const todayCompletions = await db.query.choreCompletions.findMany({
        where: eq(schema.choreCompletions.kidId, kid.id),
        with: { chore: true },
        orderBy: (c, { desc }) => [desc(c.completedAt)],
      });
      const todayDone = todayCompletions.filter((c) => dayKey(c.completedAt) === today);

      return {
        kid,
        available,
        balance,
        usedToday,
        dailyCap: family.dailyCapMinutes,
        choresDoneToday: todayDone.length,
        todayCompletions: todayDone.map((c) => ({
          id: c.id,
          choreName: c.chore.name,
          choreIcon: c.chore.icon,
          minutesAwarded: c.minutesAwarded,
          completedAt: c.completedAt,
        })),
      };
    }),
  );

  return { kids: perKid, dailyCap: family.dailyCapMinutes, bankCap: family.bankCapMinutes };
});

/* ───────────────────── single-kid today + chore catalog ────────────── */

export const getKidLogStateFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ kidId: z.number().int().positive() }).parse(data))
  .handler(async ({ data }) => {
    const familyId = await authedFamilyIdOrThrow();
    const { getDbFromEnv } = await import("./env.server");
    const db = getDbFromEnv();

    const family = await db.query.families.findFirst({ where: eq(schema.families.id, familyId) });
    if (!family) throw new Error("Family not found");

    const kid = await db.query.kids.findFirst({
      where: and(eq(schema.kids.id, data.kidId), eq(schema.kids.familyId, familyId)),
    });
    if (!kid) throw new Error("Kid not found");

    const chores = await db.query.chores.findMany({
      where: and(eq(schema.chores.familyId, familyId), eq(schema.chores.active, true)),
      orderBy: (c, { asc }) => [asc(c.sortOrder), asc(c.id)],
    });

    const events = await loadEvents(kid.id);
    const now = new Date();
    const today = dayKey(now);

    const { balance } = computeBankBalance(events, family.bankCapMinutes, now);
    const usedToday = computeDailyUsed(events, now);
    const available = computeAvailableToday({
      events,
      bankCapMinutes: family.bankCapMinutes,
      dailyCapMinutes: family.dailyCapMinutes,
      now,
    });

    // Today's completions for chip rendering + counters
    const allCompletions = await db.query.choreCompletions.findMany({
      where: eq(schema.choreCompletions.kidId, kid.id),
      with: { chore: true },
      orderBy: (c, { desc }) => [desc(c.completedAt)],
      limit: 50,
    });
    const todayCompletions = allCompletions.filter((c) => dayKey(c.completedAt) === today);

    // Week start = today minus 6 days (rolling 7-day window for "weekly")
    const weekStartMs = Date.now() - 6 * 86_400_000;
    const weekCompletions = allCompletions.filter((c) => c.completedAt.getTime() >= weekStartMs);

    // Per-chore counters
    const perChore = chores.map((c) => {
      const todayCount = todayCompletions.filter((x) => x.choreId === c.id).length;
      const weekCount = weekCompletions.filter((x) => x.choreId === c.id).length;
      const dayCapReached = c.maxPerDay !== null && todayCount >= c.maxPerDay;
      const weekCapReached = c.maxPerWeek !== null && weekCount >= c.maxPerWeek;
      return { ...c, todayCount, weekCount, dayCapReached, weekCapReached };
    });

    const todayUsage = await db.query.screenTimeEntries.findMany({
      where: eq(schema.screenTimeEntries.kidId, kid.id),
      orderBy: (e, { desc }) => [desc(e.usedAt)],
      limit: 50,
    });
    const todayUsageFiltered = todayUsage.filter((u) => dayKey(u.usedAt) === today);

    const todayAdjustments = await db.query.balanceAdjustments.findMany({
      where: eq(schema.balanceAdjustments.kidId, kid.id),
      orderBy: (a, { desc }) => [desc(a.createdAt)],
      limit: 50,
    });
    const todayAdjFiltered = todayAdjustments.filter((a) => dayKey(a.createdAt) === today);

    return {
      kid,
      family: {
        dailyCapMinutes: family.dailyCapMinutes,
        bankCapMinutes: family.bankCapMinutes,
        defaultChoreMinutes: family.defaultChoreMinutes,
      },
      chores: perChore,
      balance,
      usedToday,
      available,
      todayCompletions: todayCompletions.map((c) => ({
        id: c.id,
        choreName: c.chore.name,
        choreIcon: c.chore.icon,
        minutesAwarded: c.minutesAwarded,
        completedAt: c.completedAt,
      })),
      todayUsage: todayUsageFiltered,
      todayAdjustments: todayAdjFiltered,
    };
  });

/* ──────────────────── mutations ──────────────────── */

export const logCompletionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        kidId: z.number().int().positive(),
        choreId: z.number().int().positive(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const familyId = await authedFamilyIdOrThrow();
    const { getDbFromEnv } = await import("./env.server");
    const db = getDbFromEnv();

    const chore = await db.query.chores.findFirst({
      where: and(eq(schema.chores.id, data.choreId), eq(schema.chores.familyId, familyId)),
    });
    if (!chore || !chore.active) throw new Error("Chore not found");

    const kid = await db.query.kids.findFirst({
      where: and(eq(schema.kids.id, data.kidId), eq(schema.kids.familyId, familyId)),
    });
    if (!kid) throw new Error("Kid not found");

    // Enforce caps server-side
    const now = new Date();
    const todayStr = dayKey(now);
    if (chore.maxPerDay !== null) {
      const allComp = await db.query.choreCompletions.findMany({
        where: and(
          eq(schema.choreCompletions.kidId, kid.id),
          eq(schema.choreCompletions.choreId, chore.id),
        ),
      });
      const todayCount = allComp.filter((c) => dayKey(c.completedAt) === todayStr).length;
      if (todayCount >= chore.maxPerDay) {
        return { ok: false as const, error: "limitReached" as const };
      }
    }
    if (chore.maxPerWeek !== null) {
      const weekStartMs = Date.now() - 6 * 86_400_000;
      const weekComp = await db.query.choreCompletions.findMany({
        where: and(
          eq(schema.choreCompletions.kidId, kid.id),
          eq(schema.choreCompletions.choreId, chore.id),
          gte(schema.choreCompletions.completedAt, new Date(weekStartMs)),
        ),
      });
      if (weekComp.length >= chore.maxPerWeek) {
        return { ok: false as const, error: "weekLimitReached" as const };
      }
    }

    // Compute minutes awarded
    let minutes = 0;
    if (chore.type === "earning_daily") minutes = chore.rewardMinutes;
    else if (chore.type === "earning_weekly_quest") {
      const lo = chore.bonusMin ?? chore.rewardMinutes;
      const hi = chore.bonusMax ?? chore.rewardMinutes;
      minutes = rollQuestBonus(lo, hi);
    }
    // family_duty: minutes stays 0

    const inserted = await db
      .insert(schema.choreCompletions)
      .values({
        kidId: kid.id,
        choreId: chore.id,
        minutesAwarded: minutes,
      })
      .returning({ id: schema.choreCompletions.id });

    return { ok: true as const, id: inserted[0]!.id, minutesAwarded: minutes };
  });

export const undoCompletionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.number().int().positive() }).parse(data))
  .handler(async ({ data }) => {
    const familyId = await authedFamilyIdOrThrow();
    const { getDbFromEnv } = await import("./env.server");
    const db = getDbFromEnv();
    // Only allow deleting completions for kids in this family
    const row = await db.query.choreCompletions.findFirst({
      where: eq(schema.choreCompletions.id, data.id),
      with: { kid: true },
    });
    if (!row || row.kid.familyId !== familyId) throw new Error("Not found");
    await db.delete(schema.choreCompletions).where(eq(schema.choreCompletions.id, data.id));
    return { ok: true as const };
  });

export const logScreenTimeFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        kidId: z.number().int().positive(),
        minutes: z.number().int().min(1).max(600),
        note: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const familyId = await authedFamilyIdOrThrow();
    const { getDbFromEnv } = await import("./env.server");
    const db = getDbFromEnv();

    const kid = await db.query.kids.findFirst({
      where: and(eq(schema.kids.id, data.kidId), eq(schema.kids.familyId, familyId)),
    });
    if (!kid) throw new Error("Kid not found");

    const inserted = await db
      .insert(schema.screenTimeEntries)
      .values({ kidId: kid.id, minutes: data.minutes, note: data.note ?? null })
      .returning({ id: schema.screenTimeEntries.id });

    return { ok: true as const, id: inserted[0]!.id };
  });

export const undoScreenTimeFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.number().int().positive() }).parse(data))
  .handler(async ({ data }) => {
    const familyId = await authedFamilyIdOrThrow();
    const { getDbFromEnv } = await import("./env.server");
    const db = getDbFromEnv();
    const row = await db.query.screenTimeEntries.findFirst({
      where: eq(schema.screenTimeEntries.id, data.id),
      with: { kid: true },
    });
    if (!row || row.kid.familyId !== familyId) throw new Error("Not found");
    await db.delete(schema.screenTimeEntries).where(eq(schema.screenTimeEntries.id, data.id));
    return { ok: true as const };
  });

export const addAdjustmentFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        kidId: z.number().int().positive(),
        minutes: z.number().int().min(-600).max(600).refine((n) => n !== 0, "minutes ≠ 0"),
        reason: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const familyId = await authedFamilyIdOrThrow();
    const { getDbFromEnv } = await import("./env.server");
    const db = getDbFromEnv();
    const kid = await db.query.kids.findFirst({
      where: and(eq(schema.kids.id, data.kidId), eq(schema.kids.familyId, familyId)),
    });
    if (!kid) throw new Error("Kid not found");

    const inserted = await db
      .insert(schema.balanceAdjustments)
      .values({ kidId: kid.id, minutes: data.minutes, reason: data.reason ?? null })
      .returning({ id: schema.balanceAdjustments.id });

    return { ok: true as const, id: inserted[0]!.id };
  });

// Silence unused imports warning
void desc;
void sql;
