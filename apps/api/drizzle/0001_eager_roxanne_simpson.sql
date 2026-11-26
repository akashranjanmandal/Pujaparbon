CREATE TABLE `packaging_materials` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`unit` text DEFAULT 'pcs' NOT NULL,
	`qty` integer DEFAULT 0 NOT NULL,
	`min_qty` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`permissions` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `employees` ADD `salary_paise` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `leave_cl` integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `leave_sick` integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE `tenants` ADD `leave_earned` integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE `trip_items` ADD `gst_pct` real;--> statement-breakpoint
ALTER TABLE `users` ADD `role_id` text;