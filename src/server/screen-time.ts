import { dayKey, isFutureDay, isWeekend } from "../lib/dates";

/**
 * Pure functions for screen-time accounting.
 *
 * Model: each kid has a running "bank" of earned minutes, clamped at
 * `bankCapMinutes` whenever a positive event would push it over. A separate
 * `dailyCapMinutes` limits how many minutes can be *used* in a single
 * Bratislava day. Use exceeds cap → overage → red calendar day.
 */

export type EventKind = "award" | "adjustment" | "used";

export interface BankEvent {
  /** Award = chore completion; Adjustment = manual admin grant (can be negative); Used = screen time consumed. */
  kind: EventKind;
  at: Date;
  /** Always positive for `used`; signed for `adjustment`; positive for `award`. */
  minutes: number;
}

export interface BankResult {
  /** Net balance after replaying events. Can be negative if usage exceeded earnings. */
  balance: number;
  /** Minutes lost to bank-cap overflow over the full timeline. */
  totalDiscarded: number;
}

/**
 * Replays events in chronological order, applying the bank cap after every
 * positive change. Events after `asOf` (if given) are ignored.
 */
export function computeBankBalance(
  events: BankEvent[],
  bankCapMinutes: number,
  asOf?: Date,
): BankResult {
  const cutoff = asOf?.getTime() ?? Number.POSITIVE_INFINITY;
  const sorted = events
    .filter((e) => e.at.getTime() <= cutoff)
    .slice()
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  let balance = 0;
  let totalDiscarded = 0;

  for (const e of sorted) {
    if (e.kind === "used") {
      balance -= e.minutes;
      continue;
    }
    const next = balance + e.minutes;
    if (next > bankCapMinutes) {
      totalDiscarded += next - bankCapMinutes;
      balance = bankCapMinutes;
    } else {
      balance = next;
    }
  }

  return { balance, totalDiscarded };
}

/** Minutes used on the local Bratislava day containing `day`. */
export function computeDailyUsed(events: BankEvent[], day: Date): number {
  const key = dayKey(day);
  let used = 0;
  for (const e of events) {
    if (e.kind === "used" && dayKey(e.at) === key) used += e.minutes;
  }
  return used;
}

/**
 * What the kid is allowed to consume right now today:
 *   min(dailyCap − usedToday, max(0, bankBalance))
 * Floored at 0. Bank balance can be negative (overage debt) but doesn't
 * propagate into "available".
 */
export function computeAvailableToday(args: {
  events: BankEvent[];
  bankCapMinutes: number;
  dailyCapMinutes: number;
  now?: Date;
}): number {
  const now = args.now ?? new Date();
  const { balance } = computeBankBalance(args.events, args.bankCapMinutes, now);
  const used = computeDailyUsed(args.events, now);
  const dailyRemaining = Math.max(0, args.dailyCapMinutes - used);
  const spendable = Math.max(0, balance);
  return Math.max(0, Math.min(dailyRemaining, spendable));
}

export type DayColor = "green" | "red" | "neutral" | "blank";

export interface DayState {
  choresDoneCount: number;
  minutesUsed: number;
}

/**
 * Calendar coloring rule:
 *   future day                                   → blank
 *   used > daily cap                             → red (overage trumps everything)
 *   weekend                                      → neutral (no expectation)
 *   weekday with ≥1 chore done                   → green
 *   weekday with zero chores                     → red
 */
export function computeDayColor(args: {
  day: Date;
  state: DayState;
  dailyCapMinutes: number;
  now?: Date;
}): DayColor {
  const now = args.now ?? new Date();
  if (isFutureDay(args.day, now)) return "blank";
  if (args.state.minutesUsed > args.dailyCapMinutes) return "red";
  if (isWeekend(args.day)) return "neutral";
  if (args.state.choresDoneCount >= 1) return "green";
  return "red";
}

/** Resolves a weekly-quest bonus award amount, inclusive of bounds. */
export function rollQuestBonus(min: number, max: number, rng: () => number = Math.random): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(rng() * (hi - lo + 1));
}
