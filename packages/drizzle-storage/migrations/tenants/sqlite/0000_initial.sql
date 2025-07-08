CREATE TABLE `Tenant` (
	`context_correlation_id` text NOT NULL,
	`id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`storage_version` text,
	`config` text NOT NULL,
	`label` text NOT NULL,
	PRIMARY KEY(`context_correlation_id`, `id`),
	FOREIGN KEY (`context_correlation_id`) REFERENCES `Context`(`context_correlation_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `TenantRouting` (
	`context_correlation_id` text NOT NULL,
	`id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`tenant_id` text NOT NULL,
	`recipient_key_fingerprint` text NOT NULL,
	PRIMARY KEY(`context_correlation_id`, `id`),
	FOREIGN KEY (`context_correlation_id`) REFERENCES `Context`(`context_correlation_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`,`context_correlation_id`) REFERENCES `Tenant`(`id`,`context_correlation_id`) ON UPDATE no action ON DELETE cascade
);
