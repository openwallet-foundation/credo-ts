ALTER TABLE `OpenId4VcIssuanceSession` ADD `openid4vci_version` text;--> statement-breakpoint
ALTER TABLE `OpenId4VcVerificationSession` ADD `openid4vp_version` text;--> statement-breakpoint
-- The version was not stored in a column before, but it was stored in the custom tags
UPDATE `OpenId4VcVerificationSession` SET `openid4vp_version` = json_extract(`custom_tags`, '$.openId4VpVersion') WHERE json_extract(`custom_tags`, '$.openId4VpVersion') IS NOT NULL;