CREATE TABLE `attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`check_in_at` integer,
	`check_out_at` integer,
	`check_in_distance_m` integer,
	`check_out_distance_m` integer,
	`check_in_selfie` text,
	`check_out_selfie` text,
	`device_id` text,
	`source` text DEFAULT 'GEOFENCE' NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_day_uq` ON `attendance` (`employee_id`,`date`);--> statement-breakpoint
CREATE INDEX `attendance_date_idx` ON `attendance` (`tenant_id`,`date`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`meta` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_logs` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `bins` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`code` text NOT NULL,
	`zone` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bins_code_uq` ON `bins` (`tenant_id`,`code`);--> statement-breakpoint
CREATE TABLE `channel_listings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`channel_sku` text NOT NULL,
	`listing_id` text,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listing_channel_sku_uq` ON `channel_listings` (`tenant_id`,`channel_id`,`channel_sku`);--> statement-breakpoint
CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channels_code_uq` ON `channels` (`tenant_id`,`code`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`city` text,
	`state` text,
	`pincode` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`designation` text NOT NULL,
	`department` text NOT NULL,
	`join_date` text NOT NULL,
	`monthly_salary_paise` integer NOT NULL,
	`shift_start` text DEFAULT '10:00' NOT NULL,
	`avatar_hue` integer DEFAULT 20 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_code_uq` ON `employees` (`tenant_id`,`code`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`date` text NOT NULL,
	`category` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`note` text,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `holidays` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`date` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`kind` text NOT NULL,
	`file_name` text NOT NULL,
	`rows_total` integer NOT NULL,
	`rows_imported` integer NOT NULL,
	`rows_skipped` integer NOT NULL,
	`errors` text NOT NULL,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`variant_id` text,
	`description` text NOT NULL,
	`hsn` text NOT NULL,
	`qty` integer NOT NULL,
	`rate_paise` integer NOT NULL,
	`gst_rate` integer NOT NULL,
	`taxable_paise` integer NOT NULL,
	`tax_paise` integer NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`number` text NOT NULL,
	`date` text NOT NULL,
	`channel_id` text,
	`customer_name` text NOT NULL,
	`customer_gstin` text,
	`place_of_supply` text NOT NULL,
	`subtotal_paise` integer NOT NULL,
	`cgst_paise` integer NOT NULL,
	`sgst_paise` integer NOT NULL,
	`igst_paise` integer NOT NULL,
	`total_paise` integer NOT NULL,
	`status` text DEFAULT 'ISSUED' NOT NULL,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_number_uq` ON `invoices` (`tenant_id`,`number`);--> statement-breakpoint
CREATE TABLE `leaves` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`type` text NOT NULL,
	`from_date` text NOT NULL,
	`to_date` text NOT NULL,
	`days` integer NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`decided_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`variant_id` text,
	`channel_sku` text NOT NULL,
	`qty` integer NOT NULL,
	`price_paise` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`channel_order_id` text NOT NULL,
	`customer_id` text,
	`customer_name` text NOT NULL,
	`city` text,
	`state` text,
	`status` text NOT NULL,
	`ordered_at` integer NOT NULL,
	`dispatch_by` integer,
	`dispatched_at` integer,
	`awb` text,
	`total_paise` integer NOT NULL,
	`fees_paise` integer DEFAULT 0 NOT NULL,
	`settled_paise` integer,
	`settled_at` integer,
	`import_batch_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_channel_uq` ON `orders` (`tenant_id`,`channel_id`,`channel_order_id`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `orders_date_idx` ON `orders` (`tenant_id`,`ordered_at`);--> statement-breakpoint
CREATE TABLE `payslips` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`month` text NOT NULL,
	`working_days` integer NOT NULL,
	`present_days` real NOT NULL,
	`paid_leave_days` integer NOT NULL,
	`late_count` integer NOT NULL,
	`payable_days` real NOT NULL,
	`base_paise` integer NOT NULL,
	`gross_paise` integer NOT NULL,
	`advance_paise` integer NOT NULL,
	`net_paise` integer NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payslip_month_uq` ON `payslips` (`employee_id`,`month`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`hsn_code` text NOT NULL,
	`gst_rate` integer NOT NULL,
	`emoji` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `products_tenant_idx` ON `products` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `purchase_items` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`qty` integer NOT NULL,
	`cost_paise` integer NOT NULL,
	`bin_id` text,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`number` text NOT NULL,
	`invoice_no` text NOT NULL,
	`date` text NOT NULL,
	`total_paise` integer NOT NULL,
	`notes` text,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `refresh_tokens_token_hash_unique` ON `refresh_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `returns` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`order_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`qty` integer NOT NULL,
	`type` text NOT NULL,
	`condition` text NOT NULL,
	`status` text NOT NULL,
	`reason` text NOT NULL,
	`created_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`bin_id` text,
	`qty` integer NOT NULL,
	`type` text NOT NULL,
	`reason` text,
	`ref_type` text,
	`ref_id` text,
	`user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bin_id`) REFERENCES `bins`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `moves_variant_idx` ON `stock_movements` (`tenant_id`,`variant_id`);--> statement-breakpoint
CREATE INDEX `moves_created_idx` ON `stock_movements` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`phone` text,
	`email` text,
	`gstin` text,
	`city` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`due_date` text NOT NULL,
	`priority` text NOT NULL,
	`status` text DEFAULT 'TODO' NOT NULL,
	`note` text,
	`created_by_id` text,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`gstin` text,
	`address` text,
	`state` text DEFAULT 'West Bengal' NOT NULL,
	`geofence_lat` real NOT NULL,
	`geofence_lng` real NOT NULL,
	`geofence_radius_m` integer DEFAULT 100 NOT NULL,
	`shift_start` text DEFAULT '10:00' NOT NULL,
	`shift_end` text DEFAULT '19:00' NOT NULL,
	`late_grace_min` integer DEFAULT 10 NOT NULL,
	`selfie_retention_days` integer DEFAULT 90 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`employee_id` text,
	`device_id` text,
	`active` integer DEFAULT true NOT NULL,
	`failed_logins` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`last_login_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_uq` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `variants` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`product_id` text NOT NULL,
	`sku` text NOT NULL,
	`size` text,
	`color` text,
	`mrp_paise` integer NOT NULL,
	`price_paise` integer NOT NULL,
	`cost_paise` integer NOT NULL,
	`reorder_level` integer DEFAULT 5 NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `variants_sku_uq` ON `variants` (`tenant_id`,`sku`);--> statement-breakpoint
CREATE INDEX `variants_product_idx` ON `variants` (`product_id`);