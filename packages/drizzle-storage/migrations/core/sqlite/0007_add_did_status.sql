ALTER TABLE `Did` ADD `status` text;--> statement-breakpoint
UPDATE `Did` SET `status` = 'active';