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
import { dayKey, daysInMonth } from "../lib/dates";
import {
  computeAvailableToday,
  computeBankBalance,
  computeDailyUsed,
  computeDayColor,
  type BankEvent,
  type DayColor,
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

    // Required-for-play family duties not yet logged today → gate the kid view.
    const unmetRequired = enrichedChores
      .filter((c) => c.requiredForPlay && c.type === "family_duty" && c.todayCount === 0)
      .map((c) => ({ id: c.id, name: c.name, icon: c.icon }));

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
      unmetRequired,
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

/* ──────────────── calendar (used by kid + admin views) ──────────────── */

export interface CalendarDayPayload {
  key: string;
  color: DayColor;
  /** Earning chore completions on this day (split by type for icon display). */
  dailyDoneCount: number;
  weeklyDoneCount: number;
  minutesUsed: number;
}

export const getKidCalendarFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        kidId: z.number().int().positive(),
        year: z.number().int().min(2020).max(2100),
        month: z.number().int().min(1).max(12),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { getDbFromEnv } = await import("./env.server");
    const db = getDbFromEnv();

    const kid = await db.query.kids.findFirst({
      where: and(
        eq(schema.kids.id, data.kidId),
        eq(schema.kids.familyId, SINGLE_FAMILY_ID),
      ),
    });
    if (!kid) throw new Error("Kid not found");

    const family = await db.query.families.findFirst({
      where: eq(schema.families.id, SINGLE_FAMILY_ID),
    });
    if (!family) throw new Error("Family not found");

    // Bounds: first → last day of month UTC. Bratislava overlap handled via dayKey.
    const monthStart = new Date(Date.UTC(data.year, data.month - 1, 1));
    const monthEnd = new Date(Date.UTC(data.year, data.month - 1, daysInMonth(data.year, data.month), 23, 59, 59));

    const [completions, usage] = await Promise.all([
      db.query.choreCompletions.findMany({
        where: eq(schema.choreCompletions.kidId, kid.id),
        with: { chore: true },
      }),
      db.query.screenTimeEntries.findMany({
        where: eq(schema.screenTimeEntries.kidId, kid.id),
      }),
    ]);

    // Bucket by dayKey, split by chore type — family_duty is NOT counted as
    // an "achievement" for calendar coloring/stars (per project memory: it's
    // a rule, not a reward).
    const dailyByDay = new Map<string, number>();
    const weeklyByDay = new Map<string, number>();
    for (const c of completions) {
      if (c.completedAt < monthStart || c.completedAt > monthEnd) continue;
      const k = dayKey(c.completedAt);
      if (c.chore.type === "earning_daily") {
        dailyByDay.set(k, (dailyByDay.get(k) ?? 0) + 1);
      } else if (c.chore.type === "earning_weekly_quest") {
        weeklyByDay.set(k, (weeklyByDay.get(k) ?? 0) + 1);
      }
      // family_duty intentionally skipped
    }
    const usedByDay = new Map<string, number>();
    for (const u of usage) {
      if (u.usedAt < monthStart || u.usedAt > monthEnd) continue;
      const k = dayKey(u.usedAt);
      usedByDay.set(k, (usedByDay.get(k) ?? 0) + u.minutes);
    }

    const now = new Date();
    const days: CalendarDayPayload[] = [];
    const total = daysInMonth(data.year, data.month);
    for (let d = 1; d <= total; d++) {
      const key = `${data.year}-${String(data.month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayDate = new Date(Date.UTC(data.year, data.month - 1, d, 12)); // noon to avoid TZ-edge ambiguity
      const dailyDoneCount = dailyByDay.get(key) ?? 0;
      const weeklyDoneCount = weeklyByDay.get(key) ?? 0;
      const minutesUsed = usedByDay.get(key) ?? 0;
      const color = computeDayColor({
        day: dayDate,
        state: { choresDoneCount: dailyDoneCount + weeklyDoneCount, minutesUsed },
        dailyCapMinutes: family.dailyCapMinutes,
        now,
      });
      days.push({ key, color, dailyDoneCount, weeklyDoneCount, minutesUsed });
    }

    return { year: data.year, month: data.month, days };
  });

export const kidLogCompletionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        kidId: z.number().int().positive(),
        choreId: z.number().int().positive(),
        /** Required if the chore has `manualMinutes: true`. Ignored otherwise. */
        minutes: z.number().int().min(0).max(600).optional(),
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

    const minutes =
      chore.type === "family_duty"
        ? 0
        : chore.manualMinutes
          ? (data.minutes ?? 0)
          : chore.rewardMinutes;

    const inserted = await db
      .insert(schema.choreCompletions)
      .values({ kidId: kid.id, choreId: chore.id, minutesAwarded: minutes })
      .returning({ id: schema.choreCompletions.id });

    return { ok: true as const, id: inserted[0]!.id, minutesAwarded: minutes };
  });
