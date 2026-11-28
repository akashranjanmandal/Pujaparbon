DROP INDEX `locations_name_uq`;--> statement-breakpoint
CREATE UNIQUE INDEX `locations_name_uq` ON `locations` (`tenant_id`,`business_id`,`name`);--> statement-breakpoint
DROP INDEX `parties_name_uq`;--> statement-breakpoint
ALTER TABLE `parties` ADD `business_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `parties_name_uq` ON `parties` (`tenant_id`,`business_id`,`kind`,`name`);--> statement-breakpoint
DROP INDEX `platforms_name_uq`;--> statement-breakpoint
ALTER TABLE `platforms` ADD `business_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `platforms_name_uq` ON `platforms` (`tenant_id`,`business_id`,`name`);--> statement-breakpoint
ALTER TABLE `courier_moves` ADD `business_id` text;--> statement-breakpoint
ALTER TABLE `packaging_materials` ADD `business_id` text;