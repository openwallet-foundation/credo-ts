CREATE TABLE `MdocVerificationSession` (
	`context_correlation_id` text NOT NULL,
	`id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`state` text NOT NULL,
	`error_message` text,
	`device_request_base64_url` text NOT NULL,
	`session_transcript` text NOT NULL,
	`session_transcript_type` text NOT NULL,
	`nonce` text,
	`session_key_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`context_correlation_id`, `id`),
	FOREIGN KEY (`context_correlation_id`) REFERENCES `Context`(`context_correlation_id`) ON UPDATE no action ON DELETE cascade
);
