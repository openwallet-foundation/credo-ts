CREATE TABLE `Openid4vcIssuer` (
	`context_correlation_id` text NOT NULL,
	`id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`issuer_id` text NOT NULL,
	`access_token_public_key_fingerprint` text,
	`access_token_public_jwk` text,
	`credential_configurations_supported` text NOT NULL,
	`display` text,
	`authorization_server_configs` text,
	`dpop_signing_alg_values_supported` text,
	`batch_credential_issuance` text,
	PRIMARY KEY(`context_correlation_id`, `id`),
	FOREIGN KEY (`context_correlation_id`) REFERENCES `Context`(`context_correlation_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Openid4vcIssuer_issuer_id_unique` ON `Openid4vcIssuer` (`issuer_id`);--> statement-breakpoint
CREATE TABLE `OpenId4VcIssuanceSession` (
	`context_correlation_id` text NOT NULL,
	`id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`issuer_id` text NOT NULL,
	`expires_at` integer,
	`state` text NOT NULL,
	`issued_credentials` text,
	`pre_authorized_code` text,
	`user_pin` text,
	`client_id` text,
	`pkce` text,
	`wallet_attestation` text,
	`dpop` text,
	`authorization` text,
	`presentation` text,
	`issuance_metadata` text,
	`transactions` text,
	`credential_offer_uri` text,
	`credential_offer_id` text,
	`credential_offer_payload` text NOT NULL,
	`error_message` text,
	PRIMARY KEY(`context_correlation_id`, `id`),
	FOREIGN KEY (`issuer_id`) REFERENCES `Openid4vcIssuer`(`issuer_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`context_correlation_id`) REFERENCES `Context`(`context_correlation_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Openid4vcVerifier` (
	`context_correlation_id` text NOT NULL,
	`id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`verifier_id` text NOT NULL,
	`client_metadata` text,
	PRIMARY KEY(`context_correlation_id`, `id`),
	FOREIGN KEY (`context_correlation_id`) REFERENCES `Context`(`context_correlation_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Openid4vcVerifier_verifier_id_unique` ON `Openid4vcVerifier` (`verifier_id`);--> statement-breakpoint
CREATE TABLE `OpenId4VcVerificationSession` (
	`context_correlation_id` text NOT NULL,
	`id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`metadata` text,
	`custom_tags` text,
	`verifier_id` text NOT NULL,
	`state` text NOT NULL,
	`error_message` text,
	`authorization_request_jwt` text,
	`authorization_request_payload` text,
	`authorization_request_uri` text,
	`authorization_response_redirect_uri` text,
	`authorization_request_id` text,
	`expires_at` integer,
	`authorization_response_payload` text,
	`presentation_during_issuance_session` text,
	`nonce` text NOT NULL,
	`payload_state` text,
	PRIMARY KEY(`context_correlation_id`, `id`),
	FOREIGN KEY (`verifier_id`) REFERENCES `Openid4vcVerifier`(`verifier_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`context_correlation_id`) REFERENCES `Context`(`context_correlation_id`) ON UPDATE no action ON DELETE cascade
);
