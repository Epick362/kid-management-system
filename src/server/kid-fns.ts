/**
 * Server functions for the kid-facing UI.
 *
 * Trust model: kid views are unauthenticated by design (the family device is
 * trusted). Each function still validates that the kidId belongs to the
 * configured family so deep-links into other families' data are rejected.
 * If this app is ever deployed publicly, add a per-kid PIN here.
 */
import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import * as schema from "./schema";
import { dayKey } from "../lib/dates";
import {
  computeAvailableToday,
  computeBankBalance,
  computeDailyUsed,
  rollQuestBonus,
  type BankEvent,
} from "./screen-time";
/** v1 single-family — see family.server.ts. Inlined here to avoid a static
 *  import of a `.server.*` module from a file reachable by routes. */
const SINGLE_FAMILY_ID = 1;

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

/* ──────────────── kid landing: list of active kids ──────────────── */

export const listActiveKidsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getDbFromEnv } = await import("./env.server");
  const db = getDbFromEnv();
  const kids = await db.query.kids.findMany({
    where: and(
      eq(schema.kids.familyId, SINGLE_FAMILY_ID),
      eq(schema.kids.active, true),
    ),
    orderBy: (k, { asc }) => [asc(k.sortOrder), asc(k.id)],
  });
  return { kids };
});

/* ──────────────── kid dashboard data ──────────────── */

export const getKidDashboardFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ kidId: z.number().int().positive() }).parse(data))
  .handler(async ({ data }) => {
    const { getDbFromEnv } = await import("./env.server");
    const db = getDbFromEnv();

    const kid = await db.query.kids.findFirst({
      where: and(
        eq(schema.kids.id, data.kidId),
        eq(schema.kids.familyId, SINGLE_FAMILY_ID),
        eq(schema.kids.active, true),
      ),
    });
    if (!kid) throw new Error("Kid not found");

    const family = await db.query.families.findFirst({
      where: eq(schema.families.id, SINGLE_FAMILY_ID),
    });
    if (!family) throw new Error("Family not found");

    const chores = await db.query.chores.findMany({
      where: and(
        eq(schema.chores.familyId, SINGLE_FAMILY_ID),
        eq(schema.chores.active, true),
      ),
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

    // Per-chore today/week counters → disable caps reached
    const allCompletions = await db.query.choreCompletions.findMany({
      where: eq(schema.choreCompletions.kidId, kid.id),
      with: { chore: true },
      orderBy: (c, { desc }) => [desc(c.completedAt)],
      limit: 100,
    });
    const todayCompletions = allCompletions.filter((c) => dayKey(c.completedAt) === today);
    const weekStartMs = Date.now() - 6 * 86_400_000;
    const weekCompletions = allCompletions.filter((c) => c.completedAt.getTime() >= weekStartMs);

    const enrichedChores = chores.map((c) => {
      const todayCount = todayCompletions.filter((x) => x.choreId === c.id).length;
      const weekCount = weekCompletions.filter((x) => x.choreId === c.id).length;
      const dayCapReached = c.maxPerDay !== null && todayCount >= c.maxPerDay;
      const weekCapReached = c.maxPerWeek !== null && weekCount >= c.maxPerWeek;
      return { ...c, todayCount, weekCount, dayCapReached, weekCapReached };
    });

    return {
      kid,
      family: {
        dailyCapMinutes: family.dailyCapMinutes,
        bankCapMinutes: family.bankCapMinutes,
      },
      chores: enrichedChores,
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
    };
  });

/* ──────────────── kid-side log (no admin auth) ──────────────── */

export const kidLogCompletionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        kidId: z.number().int().positive(),
        choreId: z.number().int().positive(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { getDbFromEnv } = await import("./env.server");
    const db = getDbFromEnv();

    const chore = await db.query.chores.findFirst({
      where: and(
        eq(schema.chores.id, data.choreId),
        eq(schema.chores.familyId, SINGLE_FAMILY_ID),
        eq(schema.chores.active, true),
      ),
    });
    if (!chore) throw new Error("Chore not found");

    const kid = await db.query.kids.findFirst({
      where: and(
        eq(schema.kids.id, data.kidId),
        eq(schema.kids.familyId, SINGLE_FAMILY_ID),
        eq(schema.kids.active, true),
      ),
    });
    if (!kid) throw new Error("Kid not found");

    const now = new Date();
    const todayStr = dayKey(now);

    if (chore.maxPerDay !== null) {
      const todayDone = await db.query.choreCompletions.findMany({
        where: and(
          eq(schema.choreCompletions.kidId, kid.id),
          eq(schema.choreCompletions.choreId, chore.id),
        ),
      });
      const cnt = todayDone.filter((c) => dayKey(c.completedAt) === todayStr).length;
      if (cnt >= chore.maxPerDay) return { ok: false as const, error: "limitReached" as const };
    }
    if (chore.maxPerWeek !== null) {
      const weekStartMs = Date.now() - 6 * 86_400_000;
      const weekDone = await db.query.choreCompletions.findMany({
        where: and(
          eq(schema.choreCompletions.kidId, kid.id),
          eq(schema.choreCompletions.choreId, chore.id),
        ),
      });
      const cnt = weekDone.filter((c) => c.completedAt.getTime() >= weekStartMs).length;
      if (cnt >= chore.maxPerWeek) return { ok: false as const, error: "weekLimitReached" as const };
    }

    let minutes = 0;
    if (chore.type === "earning_daily") minutes = chore.rewardMinutes;
    else if (chore.type === "earning_weekly_quest") {
      const lo = chore.bonusMin ?? chore.rewardMinutes;
      const hi = chore.bonusMax ?? chore.rewardMinutes;
      minutes = rollQuestBonus(lo, hi);
    }

    const inserted = await db
      .insert(schema.choreCompletions)
      .values({ kidId: kid.id, choreId: chore.id, minutesAwarded: minutes })
      .returning({ id: schema.choreCompletions.id });

    return { ok: true as const, id: inserted[0]!.id, minutesAwarded: minutes };
  });
