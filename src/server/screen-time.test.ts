import { describe, it, expect } from "vitest";
import {
  computeBankBalance,
  computeDailyUsed,
  computeAvailableToday,
  computeDayColor,
  rollQuestBonus,
  type BankEvent,
} from "./screen-time";

// All test dates use Europe/Bratislava. May is CEST (UTC+2), so to land on
// "2026-05-15 14:00 local" we use UTC 12:00.
const at = (iso: string) => new Date(iso);

describe("computeBankBalance", () => {
  it("sums awards", () => {
    const events: BankEvent[] = [
      { kind: "award", at: at("2026-05-15T10:00:00Z"), minutes: 15 },
      { kind: "award", at: at("2026-05-15T11:00:00Z"), minutes: 10 },
    ];
    expect(computeBankBalance(events, 180)).toEqual({ balance: 25, totalDiscarded: 0 });
  });

  it("clamps at the bank cap and reports discarded minutes", () => {
    const events: BankEvent[] = [
      { kind: "award", at: at("2026-05-15T10:00:00Z"), minutes: 100 },
      { kind: "award", at: at("2026-05-15T11:00:00Z"), minutes: 100 }, // would push to 200, capped at 180
    ];
    expect(computeBankBalance(events, 180)).toEqual({ balance: 180, totalDiscarded: 20 });
  });

  it("subtracts used minutes from the bank", () => {
    const events: BankEvent[] = [
      { kind: "award", at: at("2026-05-15T10:00:00Z"), minutes: 40 },
      { kind: "used",  at: at("2026-05-15T18:00:00Z"), minutes: 30 },
    ];
    expect(computeBankBalance(events, 180).balance).toBe(10);
  });

  it("allows negative balance when usage exceeds earnings (overage)", () => {
    const events: BankEvent[] = [
      { kind: "award", at: at("2026-05-15T10:00:00Z"), minutes: 20 },
      { kind: "used",  at: at("2026-05-15T18:00:00Z"), minutes: 50 },
    ];
    expect(computeBankBalance(events, 180).balance).toBe(-30);
  });

  it("clamps after each chronological event, not just at the end", () => {
    // award 150 → balance 150 (cap 180, no discard)
    // used 100 → balance 50
    // award 200 → would push to 250, capped at 180, discard 70
    const events: BankEvent[] = [
      { kind: "award", at: at("2026-05-15T10:00:00Z"), minutes: 150 },
      { kind: "used",  at: at("2026-05-15T12:00:00Z"), minutes: 100 },
      { kind: "award", at: at("2026-05-15T14:00:00Z"), minutes: 200 },
    ];
    expect(computeBankBalance(events, 180)).toEqual({ balance: 180, totalDiscarded: 70 });
  });

  it("respects asOf cutoff", () => {
    const events: BankEvent[] = [
      { kind: "award", at: at("2026-05-15T10:00:00Z"), minutes: 30 },
      { kind: "award", at: at("2026-05-16T10:00:00Z"), minutes: 30 },
    ];
    expect(computeBankBalance(events, 180, at("2026-05-15T23:59:00Z")).balance).toBe(30);
  });

  it("handles negative adjustments", () => {
    const events: BankEvent[] = [
      { kind: "award",      at: at("2026-05-15T10:00:00Z"), minutes: 40 },
      { kind: "adjustment", at: at("2026-05-15T11:00:00Z"), minutes: -10 },
    ];
    expect(computeBankBalance(events, 180).balance).toBe(30);
  });

  it("sorts unordered events chronologically before replay", () => {
    const events: BankEvent[] = [
      { kind: "award", at: at("2026-05-15T14:00:00Z"), minutes: 200 },
      { kind: "used",  at: at("2026-05-15T12:00:00Z"), minutes: 100 },
      { kind: "award", at: at("2026-05-15T10:00:00Z"), minutes: 150 },
    ];
    // Same scenario as the "clamps after each event" test above.
    expect(computeBankBalance(events, 180)).toEqual({ balance: 180, totalDiscarded: 70 });
  });
});

describe("computeDailyUsed", () => {
  it("sums only the matching local-day 'used' events", () => {
    const events: BankEvent[] = [
      { kind: "used",  at: at("2026-05-15T08:00:00Z"), minutes: 20 }, // CEST = 10:00 local
      { kind: "used",  at: at("2026-05-15T20:00:00Z"), minutes: 30 }, // CEST = 22:00 local — same day
      { kind: "award", at: at("2026-05-15T10:00:00Z"), minutes: 99 }, // awards ignored
      { kind: "used",  at: at("2026-05-16T06:00:00Z"), minutes: 99 }, // next day
    ];
    expect(computeDailyUsed(events, at("2026-05-15T12:00:00Z"))).toBe(50);
  });

  it("buckets late-night events to the correct local day (CEST boundary)", () => {
    // 2026-05-15T22:30Z = 2026-05-16 00:30 Bratislava → counts toward May 16.
    const events: BankEvent[] = [
      { kind: "used", at: at("2026-05-15T22:30:00Z"), minutes: 15 },
    ];
    expect(computeDailyUsed(events, at("2026-05-15T10:00:00Z"))).toBe(0);
    expect(computeDailyUsed(events, at("2026-05-16T10:00:00Z"))).toBe(15);
  });
});

describe("computeAvailableToday", () => {
  it("is bounded by the daily cap", () => {
    const events: BankEvent[] = [
      { kind: "award", at: at("2026-05-15T08:00:00Z"), minutes: 200 }, // capped at bank 180
    ];
    expect(
      computeAvailableToday({
        events,
        bankCapMinutes: 180,
        dailyCapMinutes: 90,
        now: at("2026-05-15T12:00:00Z"),
      }),
    ).toBe(90);
  });

  it("is bounded by the bank balance when bank < daily cap", () => {
    const events: BankEvent[] = [
      { kind: "award", at: at("2026-05-15T08:00:00Z"), minutes: 25 },
    ];
    expect(
      computeAvailableToday({
        events,
        bankCapMinutes: 180,
        dailyCapMinutes: 90,
        now: at("2026-05-15T12:00:00Z"),
      }),
    ).toBe(25);
  });

  it("reduces by today's usage", () => {
    const events: BankEvent[] = [
      { kind: "award", at: at("2026-05-15T08:00:00Z"), minutes: 200 }, // → bank 180
      { kind: "used",  at: at("2026-05-15T15:00:00Z"), minutes: 30 },  // bank 150, daily used 30
    ];
    // daily remaining = 90 - 30 = 60, bank = 150 → min 60.
    expect(
      computeAvailableToday({
        events,
        bankCapMinutes: 180,
        dailyCapMinutes: 90,
        now: at("2026-05-15T16:00:00Z"),
      }),
    ).toBe(60);
  });

  it("floors at 0 (never negative)", () => {
    const events: BankEvent[] = [
      { kind: "used", at: at("2026-05-15T15:00:00Z"), minutes: 50 },
    ];
    expect(
      computeAvailableToday({
        events,
        bankCapMinutes: 180,
        dailyCapMinutes: 90,
        now: at("2026-05-15T16:00:00Z"),
      }),
    ).toBe(0);
  });
});

describe("computeDayColor", () => {
  const dailyCap = 90;
  const now = at("2026-05-16T10:00:00Z"); // Saturday in Bratislava

  it("returns blank for future days", () => {
    expect(
      computeDayColor({
        day: at("2026-05-20T12:00:00Z"),
        state: { choresDoneCount: 5, minutesUsed: 0 },
        dailyCapMinutes: dailyCap,
        now,
      }),
    ).toBe("blank");
  });

  it("returns red when usage exceeds the daily cap (even with chores done)", () => {
    expect(
      computeDayColor({
        day: at("2026-05-15T12:00:00Z"), // Friday (weekday)
        state: { choresDoneCount: 3, minutesUsed: 95 },
        dailyCapMinutes: dailyCap,
        now,
      }),
    ).toBe("red");
  });

  it("returns red when overage occurs on a weekend", () => {
    expect(
      computeDayColor({
        day: at("2026-05-16T12:00:00Z"), // Saturday
        state: { choresDoneCount: 0, minutesUsed: 120 },
        dailyCapMinutes: dailyCap,
        now,
      }),
    ).toBe("red");
  });

  it("returns neutral on a weekend with no overage", () => {
    expect(
      computeDayColor({
        day: at("2026-05-16T12:00:00Z"), // Saturday
        state: { choresDoneCount: 0, minutesUsed: 60 },
        dailyCapMinutes: dailyCap,
        now,
      }),
    ).toBe("neutral");
  });

  it("returns green on a weekday with at least one chore done", () => {
    expect(
      computeDayColor({
        day: at("2026-05-15T12:00:00Z"), // Friday
        state: { choresDoneCount: 1, minutesUsed: 30 },
        dailyCapMinutes: dailyCap,
        now,
      }),
    ).toBe("green");
  });

  it("returns red on a weekday with zero chores", () => {
    expect(
      computeDayColor({
        day: at("2026-05-15T12:00:00Z"),
        state: { choresDoneCount: 0, minutesUsed: 0 },
        dailyCapMinutes: dailyCap,
        now,
      }),
    ).toBe("red");
  });
});

describe("rollQuestBonus", () => {
  it("stays within bounds inclusive", () => {
    const samples = Array.from({ length: 1000 }, () => rollQuestBonus(15, 30));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(15);
    expect(Math.max(...samples)).toBeLessThanOrEqual(30);
  });

  it("handles reversed bounds", () => {
    expect(rollQuestBonus(30, 15, () => 0)).toBe(15);
    expect(rollQuestBonus(30, 15, () => 0.999)).toBe(30);
  });

  it("is deterministic with a seeded rng", () => {
    expect(rollQuestBonus(20, 40, () => 0)).toBe(20);
    expect(rollQuestBonus(20, 40, () => 0.999)).toBe(40);
    expect(rollQuestBonus(20, 40, () => 0.5)).toBe(30);
  });
});
