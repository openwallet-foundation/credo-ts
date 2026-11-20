ALTER TABLE "Openid4vcIssuer" ADD COLUMN "access_token_key" jsonb;--> statement-breakpoint
ALTER TABLE "Openid4vcIssuer" ADD COLUMN "previous_access_token_keys" jsonb;--> statement-breakpoint
ALTER TABLE "OpenId4VcVerificationSession" ADD COLUMN "response_encryption_key" jsonb;