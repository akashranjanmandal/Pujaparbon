CREATE TABLE `claims` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`platform_id` text NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'RAISED' NOT NULL,
	`reason` text,
	`expected_paise` integer DEFAULT 0 NOT NULL,
	`received_paise` integer DEFAULT 0 NOT NULL,
	`note` text,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `claims_platform_idx` ON `claims` (`tenant_id`,`platform_id`,`date`);