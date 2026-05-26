CREATE TABLE `admin_install_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` integer NOT NULL,
	`label` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `chores` ADD `manual_minutes` integer DEFAULT false NOT NULL;