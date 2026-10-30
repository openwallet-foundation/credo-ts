ALTER TABLE "OpenId4VcIssuanceSession" ADD COLUMN "openid4vci_version" text;--> statement-breakpoint
ALTER TABLE "OpenId4VcVerificationSession" ADD COLUMN "openid4vp_version" text;--> statement-breakpoint
-- The version was not stored in a column before, but it was stored in the custom tags
UPDATE "OpenId4VcVerificationSession" SET "openid4vp_version" = "custom_tags"->>'openId4VpVersion' WHERE "custom_tags" ? 'openId4VpVersion';