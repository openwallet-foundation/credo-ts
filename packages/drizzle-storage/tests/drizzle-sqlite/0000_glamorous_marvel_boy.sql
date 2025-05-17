CREATE TABLE `GenericRecord` (
	`context_correlation_id` text NOT NULL,
	`id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`content` text NOT NULL,
	PRIMARY KEY(`context_correlation_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `SdJwtVc` (
	`context_correlation_id` text NOT NULL,
	`id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`vct` text NOT NULL,
	`alg` text NOT NULL,
	`sd_alg` text NOT NULL,
	`compact_sd_jwt_vc` text NOT NULL,
	PRIMARY KEY(`context_correlation_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `Mdoc` (
	`context_correlation_id` text NOT NULL,
	`id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`base64_url` text NOT NULL,
	`alg` text NOT NULL,
	`doc_type` text NOT NULL,
	PRIMARY KEY(`context_correlation_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `StorageVersion` (
	`context_correlation_id` text NOT NULL,
	`id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`storage_version` text NOT NULL,
	PRIMARY KEY(`context_correlation_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `DidcommConnection` (
	`context_correlation_id` text NOT NULL,
	`id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`state` text NOT NULL,
	`role` text NOT NULL,
	`did` text,
	`their_did` text,
	`their_label` text,
	`alias` text,
	`auto_accept_connection` integer,
	`image_url` text,
	`thread_id` text,
	`invitation_did` text,
	`mediator_id` text,
	`out_of_band_id` text,
	`error_message` text,
	`protocol` text,
	`connection_types` text,
	`previous_dids` text,
	`previous_their_dids` text,
	PRIMARY KEY(`context_correlation_id`, `id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `DidcommConnection_thread_id_unique` ON `DidcommConnection` (`thread_id`);