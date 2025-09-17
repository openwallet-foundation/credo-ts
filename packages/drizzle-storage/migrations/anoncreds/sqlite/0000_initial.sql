CREATE TABLE `AnonCredsCredential` (
	`context_correlation_id` text NOT NULL,
	`id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`credential_id` text NOT NULL,
	`credential_revocation_id` text,
	`link_secret_id` text NOT NULL,
	`credential` text NOT NULL,
	`method_name` text NOT NULL,
	`credential_definition_id` text NOT NULL,
	`revocation_registry_id` text,
	`schema_id` text NOT NULL,
	`schema_name` text NOT NULL,
	`schema_version` text NOT NULL,
	`schema_issuer_id` text NOT NULL,
	`issuer_id` text NOT NULL,
	PRIMARY KEY(`context_correlation_id`, `id`),
	FOREIGN KEY (`context_correlation_id`) REFERENCES `Context`(`context_correlation_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `AnonCredsCredentialDefinition` (
	`context_correlation_id` text NOT NULL,
	`id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`credential_definition_id` text NOT NULL,
	`credential_definition` text NOT NULL,
	`method_name` text NOT NULL,
	`schema_id` text NOT NULL,
	`issuer_id` text NOT NULL,
	`tag` text NOT NULL,
	`unqualified_credential_definition_id` text,
	PRIMARY KEY(`context_correlation_id`, `id`),
	FOREIGN KEY (`context_correlation_id`) REFERENCES `Context`(`context_correlation_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AnonCredsCredentialDefinition_credential_definition_id_unique` ON `AnonCredsCredentialDefinition` (`credential_definition_id`);--> statement-breakpoint
CREATE TABLE `AnonCredsCredentialDefinitionPrivate` (
	`context_correlation_id` text NOT NULL,
	`id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`credential_definition_id` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`context_correlation_id`, `id`),
	FOREIGN KEY (`context_correlation_id`) REFERENCES `Context`(`context_correlation_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AnonCredsCredentialDefinitionPrivate_credential_definition_id_unique` ON `AnonCredsCredentialDefinitionPrivate` (`credential_definition_id`);--> statement-breakpoint
CREATE TABLE `AnonCredsKeyCorrectnessProof` (
	`context_correlation_id` text NOT NULL,
	`id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`credential_definition_id` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`context_correlation_id`, `id`),
	FOREIGN KEY (`context_correlation_id`) REFERENCES `Context`(`context_correlation_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AnonCredsKeyCorrectnessProof_credential_definition_id_unique` ON `AnonCredsKeyCorrectnessProof` (`credential_definition_id`);--> statement-breakpoint
CREATE TABLE `AnonCredsLinkSecret` (
	`context_correlation_id` text NOT NULL,
	`id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`link_secret_id` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`value` text,
	PRIMARY KEY(`context_correlation_id`, `id`),
	FOREIGN KEY (`context_correlation_id`) REFERENCES `Context`(`context_correlation_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `link_secret_id_context_correlation_id_unique` ON `AnonCredsLinkSecret` (`link_secret_id`,`context_correlation_id`);--> statement-breakpoint
CREATE TABLE `AnonCredsRevocationRegistryDefinition` (
	`context_correlation_id` text NOT NULL,
	`id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`revocation_registry_definition_id` text NOT NULL,
	`revocation_registry_definition` text NOT NULL,
	`credential_definition_id` text NOT NULL,
	PRIMARY KEY(`context_correlation_id`, `id`),
	FOREIGN KEY (`context_correlation_id`) REFERENCES `Context`(`context_correlation_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AnonCredsRevocationRegistryDefinition_revocation_registry_definition_id_unique` ON `AnonCredsRevocationRegistryDefinition` (`revocation_registry_definition_id`);--> statement-breakpoint
CREATE TABLE `AnonCredsRevocationRegistryDefinitionPrivate` (
	`context_correlation_id` text NOT NULL,
	`id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`state` text NOT NULL,
	`revocation_registry_definition_id` text NOT NULL,
	`credential_definition_id` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`context_correlation_id`, `id`),
	FOREIGN KEY (`context_correlation_id`) REFERENCES `Context`(`context_correlation_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AnonCredsRevocationRegistryDefinitionPrivate_revocation_registry_definition_id_unique` ON `AnonCredsRevocationRegistryDefinitionPrivate` (`revocation_registry_definition_id`);--> statement-breakpoint
CREATE TABLE `AnonCredsSchema` (
	`context_correlation_id` text NOT NULL,
	`id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`schema_id` text NOT NULL,
	`schema` text NOT NULL,
	`issuer_id` text NOT NULL,
	`schema_name` text NOT NULL,
	`schema_version` text NOT NULL,
	`method_name` text NOT NULL,
	`unqualified_schema_id` text,
	PRIMARY KEY(`context_correlation_id`, `id`),
	FOREIGN KEY (`context_correlation_id`) REFERENCES `Context`(`context_correlation_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `AnonCredsSchema_schema_id_unique` ON `AnonCredsSchema` (`schema_id`);