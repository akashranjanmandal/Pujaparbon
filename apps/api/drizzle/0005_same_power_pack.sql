CREATE TABLE `batch_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`product_id` text NOT NULL,
	`side` text NOT NULL,
	`qty` real NOT NULL,
	`value_paise` integer NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `batches` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`inputs_paise` integer NOT NULL,
	`costs_paise` integer NOT NULL,
	`total_paise` integer NOT NULL,
	`costs` text NOT NULL,
	`note` text,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `batches_date_idx` ON `batches` (`tenant_id`,`date`);--> statement-breakpoint
CREATE TABLE `courier_moves` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`date` text NOT NULL,
	`platform_id` text,
	`courier` text NOT NULL,
	`outgoing` integer DEFAULT 0 NOT NULL,
	`customer_return` integer DEFAULT 0 NOT NULL,
	`rto` integer DEFAULT 0 NOT NULL,
	`time` text,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `courier_date_idx` ON `courier_moves` (`tenant_id`,`date`);--> statement-breakpoint
CREATE TABLE `fund_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`date` text NOT NULL,
	`from_business_id` text NOT NULL,
	`to_business_id` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`note` text,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `funds_date_idx` ON `fund_transfers` (`tenant_id`,`date`);--> statement-breakpoint
ALTER TABLE `investments` ADD `location_id` text;--> statement-breakpoint
ALTER TABLE `products` ADD `gst_pct` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sale_items` ADD `gst_pct` real DEFAULT 0 NOT NULL;