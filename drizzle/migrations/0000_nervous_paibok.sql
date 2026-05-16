CREATE TABLE `admin_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `balance_adjustments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kid_id` integer NOT NULL,
	`minutes` integer NOT NULL,
	`reason` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`kid_id`) REFERENCES `kids`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_adj_kid_time` ON `balance_adjustments` (`kid_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `chore_completions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kid_id` integer NOT NULL,
	`chore_id` integer NOT NULL,
	`completed_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`minutes_awarded` integer DEFAULT 0 NOT NULL,
	`note` text,
	FOREIGN KEY (`kid_id`) REFERENCES `kids`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chore_id`) REFERENCES `chores`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_completions_kid_time` ON `chore_completions` (`kid_id`,`completed_at`);--> statement-breakpoint
CREATE TABLE `chores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`name` text NOT NULL,
	`icon` text DEFAULT '✨' NOT NULL,
	`type` text NOT NULL,
	`reward_minutes` integer DEFAULT 0 NOT NULL,
	`bonus_min` integer,
	`bonus_max` integer,
	`max_per_day` integer,
	`max_per_week` integer,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chores_family` ON `chores` (`family_id`);--> statement-breakpoint
CREATE TABLE `families` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`admin_password_hash` text,
	`daily_cap_minutes` integer DEFAULT 90 NOT NULL,
	`bank_cap_minutes` integer DEFAULT 180 NOT NULL,
	`default_chore_minutes` integer DEFAULT 10 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `kids` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT 'mint' NOT NULL,
	`avatar_emoji` text DEFAULT '🙂' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_kids_family` ON `kids` (`family_id`);--> statement-breakpoint
CREATE TABLE `screen_time_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kid_id` integer NOT NULL,
	`used_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`minutes` integer NOT NULL,
	`note` text,
	FOREIGN KEY (`kid_id`) REFERENCES `kids`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_screen_kid_time` ON `screen_time_entries` (`kid_id`,`used_at`);