-- Run once after the first migration:
--   wrangler d1 execute kms-db --local --file=./drizzle/seed.sql
--   wrangler d1 execute kms-db --remote --file=./drizzle/seed.sql
--
-- Creates one family (no password yet — admin sets it on first login),
-- one kid (Miško), and a starter chore catalog in Slovak.
-- All values are editable in the admin UI; this is just a sensible default.

INSERT INTO families (id, name, admin_password_hash, daily_cap_minutes, bank_cap_minutes, default_chore_minutes)
VALUES (1, 'Naša rodina', NULL, 90, 180, 10);

INSERT INTO kids (family_id, name, color, avatar_emoji, sort_order, active)
VALUES (1, 'Miško', 'sky', '🦊', 0, 1);

-- Family duties: logged but no reward (overjustification guard).
INSERT INTO chores (family_id, name, icon, type, reward_minutes, max_per_day, sort_order, active) VALUES
  (1, 'Postielanie postele', '🛏️', 'family_duty', 0, 1, 10, 1),
  (1, 'Odložiť oblečenie',  '👕', 'family_duty', 0, 1, 11, 1),
  (1, 'Odniesť tanier',     '🍽️', 'family_duty', 0, 3, 12, 1);

-- Daily earning chores: repeatable, fixed reward.
INSERT INTO chores (family_id, name, icon, type, reward_minutes, max_per_day, sort_order, active) VALUES
  (1, 'Umyť riad',           '🧽', 'earning_daily', 15, 1, 20, 1),
  (1, 'Vyniesť smeti',       '🗑️', 'earning_daily', 10, 1, 21, 1),
  (1, 'Vysávať izbu',        '🌀', 'earning_daily', 15, 1, 22, 1),
  (1, 'Polievanie kvetov',   '🌱', 'earning_daily',  5, 1, 23, 1),
  (1, 'Domáca úloha',        '📚', 'earning_daily', 20, 1, 24, 1),
  (1, 'Cvičenie 15 minút',   '🏃', 'earning_daily', 15, 1, 25, 1);

-- Weekly quests: variable bonus, once per week.
INSERT INTO chores (family_id, name, icon, type, reward_minutes, bonus_min, bonus_max, max_per_week, sort_order, active) VALUES
  (1, 'Veľké upratovanie izby', '🧹', 'earning_weekly_quest', 0, 20, 40, 1, 30, 1),
  (1, 'Pomoc s nákupom',        '🛒', 'earning_weekly_quest', 0, 15, 30, 1, 31, 1);
