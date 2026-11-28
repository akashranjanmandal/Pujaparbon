CREATE TABLE `losses` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`business_id` text,
	`location_id` text,
	`product_id` text,
	`qty` real NOT NULL,
	`value_paise` integer NOT NULL,
	`date` text NOT NULL,
	`reason` text NOT NULL,
	`note` text,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `losses_date_idx` ON `losses` (`tenant_id`,`date`);--> statement-breakpoint
CREATE TABLE `parties` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`phone` text,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `parties_name_uq` ON `parties` (`tenant_id`,`kind`,`name`);--> statement-breakpoint
CREATE TABLE `party_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`party_id` text NOT NULL,
	`kind` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`date` text NOT NULL,
	`business_id` text,
	`ref_type` text,
	`ref_id` text,
	`note` text,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `entries_party_idx` ON `party_entries` (`party_id`,`date`);--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` text PRIMARY KEY NOT NULL,
	`sale_id` text NOT NULL,
	`product_id` text NOT NULL,
	`qty` real NOT NULL,
	`unit_price_paise` integer NOT NULL,
	`line_paise` integer NOT NULL,
	`cost_paise` integer NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sale_returns` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`business_id` text NOT NULL,
	`location_id` text,
	`product_id` text NOT NULL,
	`qty` real NOT NULL,
	`date` text NOT NULL,
	`condition` text NOT NULL,
	`refund_paise` integer DEFAULT 0 NOT NULL,
	`cost_paise` integer DEFAULT 0 NOT NULL,
	`note` text,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `returns_date_idx` ON `sale_returns` (`tenant_id`,`date`);--> statement-breakpoint
CREATE TABLE `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`business_id` text NOT NULL,
	`location_id` text,
	`channel` text NOT NULL,
	`date` text NOT NULL,
	`customer_id` text,
	`total_paise` integer NOT NULL,
	`paid_paise` integer NOT NULL,
	`cost_paise` integer DEFAULT 0 NOT NULL,
	`note` text,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bill_sales_date_idx` ON `sales` (`tenant_id`,`date`);--> statement-breakpoint
CREATE INDEX `bill_sales_biz_idx` ON `sales` (`business_id`,`date`);--> statement-breakpoint
ALTER TABLE `investments` ADD `business_id` text;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `location_id` text;