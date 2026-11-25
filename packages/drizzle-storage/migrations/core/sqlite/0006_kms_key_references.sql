PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_MdocVerificationSession` (
	`context_correlation_id` text NOT NULL,
	`id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`state` text NOT NULL,
	`error_message` text,
	`device_request_base64_url` text NOT NULL,
	`device_request_definition` text NOT NULL,
	`session_transcript` text NOT NULL,
	`session_transcript_type` text NOT NULL,
	`nonce` text,
	`session_key` text,
	`session_key_id` text,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`context_correlation_id`, `id`),
	FOREIGN KEY (`context_correlation_id`) REFERENCES `Context`(`context_correlation_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_MdocVerificationSession`("context_correlation_id", "id", "created_at", "updated_at", "metadata", "custom_tags", "state", "error_message", "device_request_base64_url", "device_request_definition", "session_transcript", "session_transcript_type", "nonce", "session_key", "session_key_id", "expires_at") SELECT "context_correlation_id", "id", "created_at", "updated_at", "metadata", "custom_tags", "state", "error_message", "device_request_base64_url", "device_request_definition", "session_transcript", "session_transcript_type", "nonce", NULL, "session_key_id", "expires_at" FROM `MdocVerificationSession`;--> statement-breakpoint
DROP TABLE `MdocVerificationSession`;--> statement-breakpoint
ALTER TABLE `__new_MdocVerificationSession` RENAME TO `MdocVerificationSession`;--> statement-breakpoint
PRAGMA foreign_keys=ON;