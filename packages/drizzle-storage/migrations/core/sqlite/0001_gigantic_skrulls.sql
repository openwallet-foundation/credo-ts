CREATE TABLE `W3cV2Credential` (
	`context_correlation_id` text NOT NULL,
	`id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`credential` text NOT NULL,
	`issuer_id` text NOT NULL,
	`subject_ids` text NOT NULL,
	`schema_ids` text NOT NULL,
	`contexts` text NOT NULL,
	`types` text NOT NULL,
	`given_id` text,
	`claim_format` text NOT NULL,
	`algs` text,
	PRIMARY KEY(`context_correlation_id`, `id`),
	FOREIGN KEY (`context_correlation_id`) REFERENCES `Context`(`context_correlation_id`) ON UPDATE no action ON DELETE cascade
);
