CREATE TABLE `DidcommDrpc` (
	`context_correlation_id` text NOT NULL,
	`id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`request` text,
	`response` text,
	`state` text NOT NULL,
	`role` text NOT NULL,
	`connection_id` text NOT NULL,
	`thread_id` text NOT NULL,
	PRIMARY KEY(`context_correlation_id`, `id`),
	FOREIGN KEY (`context_correlation_id`) REFERENCES `Context`(`context_correlation_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`,`context_correlation_id`) REFERENCES `DidcommConnection`(`id`,`context_correlation_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `DidcommDrpc_context_correlation_id_thread_id_unique` ON `DidcommDrpc` (`context_correlation_id`,`thread_id`);