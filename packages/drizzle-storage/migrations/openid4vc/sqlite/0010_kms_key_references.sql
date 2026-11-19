ALTER TABLE `Openid4vcIssuer` ADD `access_token_key` text;--> statement-breakpoint
ALTER TABLE `Openid4vcIssuer` ADD `previous_access_token_keys` text;--> statement-breakpoint
ALTER TABLE `OpenId4VcVerificationSession` ADD `response_encryption_key` text;