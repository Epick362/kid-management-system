import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm";

/**
 * One family per deployment for v1. Schema permits multi-family later.
 * `admin_password_hash` is set on first-run setup; sessions live in `admin_sessions`.
 */
export const families = sqliteTable("families", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  /** NULL until first-run setup completes (admin sets a password on first visit). */
  adminPasswordHash: text("admin_password_hash"),
  dailyCapMinutes: integer("daily_cap_minutes").notNull().default(90),
  bankCapMinutes: integer("bank_cap_minutes").notNull().default(180),
  defaultChoreMinutes: integer("default_chore_minutes").notNull().default(10),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
});

export const kids = sqliteTable(
  "kids",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    familyId: integer("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("mint"),
    avatarEmoji: text("avatar_emoji").notNull().default("🙂"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [index("idx_kids_family").on(t.familyId)],
);

/** `family_duty` chores are logged but never grant minutes (overjustification guard). */
export const choreTypes = ["family_duty", "earning_daily", "earning_weekly_quest"] as const;
export type ChoreType = (typeof choreTypes)[number];

export const chores = sqliteTable(
  "chores",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    familyId: integer("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon").notNull().default("✨"),
    type: text("type", { enum: choreTypes }).notNull(),
    rewardMinutes: integer("reward_minutes").notNull().default(0),
    bonusMin: integer("bonus_min"),
    bonusMax: integer("bonus_max"),
    maxPerDay: integer("max_per_day"),
    maxPerWeek: integer("max_per_week"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("idx_chores_family").on(t.familyId)],
);

/**
 * Records a chore being done. `minutes_awarded` is captured at completion time
 * so retroactive reward edits don't change history. For weekly quests this is
 * `random(bonus_min, bonus_max)`; for family_duty it's 0.
 */
export const choreCompletions = sqliteTable(
  "chore_completions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kidId: integer("kid_id")
      .notNull()
      .references(() => kids.id, { onDelete: "cascade" }),
    choreId: integer("chore_id")
      .notNull()
      .references(() => chores.id, { onDelete: "restrict" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
    minutesAwarded: integer("minutes_awarded").notNull().default(0),
    note: text("note"),
  },
  (t) => [
    index("idx_completions_kid_time").on(t.kidId, t.completedAt),
  ],
);

export const screenTimeEntries = sqliteTable(
  "screen_time_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kidId: integer("kid_id")
      .notNull()
      .references(() => kids.id, { onDelete: "cascade" }),
    usedAt: integer("used_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
    minutes: integer("minutes").notNull(),
    note: text("note"),
  },
  (t) => [
    index("idx_screen_kid_time").on(t.kidId, t.usedAt),
  ],
);

/** Manual admin awards / corrections. Positive = give, negative = remove (rarely used). */
export const balanceAdjustments = sqliteTable(
  "balance_adjustments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kidId: integer("kid_id")
      .notNull()
      .references(() => kids.id, { onDelete: "cascade" }),
    minutes: integer("minutes").notNull(),
    reason: text("reason"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
  },
  (t) => [index("idx_adj_kid_time").on(t.kidId, t.createdAt)],
);

export const adminSessions = sqliteTable("admin_sessions", {
  id: text("id").primaryKey(),
  familyId: integer("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
});

/* ---------- relations (used by drizzle's relational query API) ---------- */

export const familiesRelations = relations(families, ({ many }) => ({
  kids: many(kids),
  chores: many(chores),
}));

export const kidsRelations = relations(kids, ({ one, many }) => ({
  family: one(families, { fields: [kids.familyId], references: [families.id] }),
  completions: many(choreCompletions),
  screenTimeEntries: many(screenTimeEntries),
  adjustments: many(balanceAdjustments),
}));

export const choresRelations = relations(chores, ({ one, many }) => ({
  family: one(families, { fields: [chores.familyId], references: [families.id] }),
  completions: many(choreCompletions),
}));

export const choreCompletionsRelations = relations(choreCompletions, ({ one }) => ({
  kid: one(kids, { fields: [choreCompletions.kidId], references: [kids.id] }),
  chore: one(chores, { fields: [choreCompletions.choreId], references: [chores.id] }),
}));

/* ---------- type exports ---------- */

export type Family = typeof families.$inferSelect;
export type Kid = typeof kids.$inferSelect;
export type Chore = typeof chores.$inferSelect;
export type ChoreCompletion = typeof choreCompletions.$inferSelect;
export type ScreenTimeEntry = typeof screenTimeEntries.$inferSelect;
export type BalanceAdjustment = typeof balanceAdjustments.$inferSelect;
