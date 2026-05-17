CREATE TABLE `behavior_incidents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kid_id` integer NOT NULL,
	`category` text NOT NULL,
	`note` text,
	`recorded_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`kid_id`) REFERENCES `kids`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_incidents_kid_time` ON `behavior_incidents` (`kid_id`,`recorded_at`);--> statement-breakpoint
ALTER TABLE `chores` ADD `required_for_play` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `kids` ADD `theme` text DEFAULT 'default' NOT NULL;