-- Default [] is because SQLITE doesn't allow changing the column properties afterwards
-- Only other solution is to create a new table, migrate all rows and then drop+rename.

-- Mdoc migration
ALTER TABLE `Mdoc` ADD `credential_instances` text NOT NULL DEFAULT '[]';--> statement-breakpoint
UPDATE `Mdoc` SET `credential_instances` = json_array(
  json_object('issuerSignedBase64Url', `base64_url`)
);--> statement-breakpoint
ALTER TABLE `Mdoc` DROP COLUMN `base64_url`;--> statement-breakpoint

-- SdJwtVc migration
ALTER TABLE `SdJwtVc` ADD `credential_instances` text NOT NULL DEFAULT '[]';--> statement-breakpoint
UPDATE `SdJwtVc` SET `credential_instances` = json_array(
  json_object('compactSdJwtVc', `compact_sd_jwt_vc`)
);--> statement-breakpoint
ALTER TABLE `SdJwtVc` DROP COLUMN `compact_sd_jwt_vc`;--> statement-breakpoint

-- W3cCredential migration
ALTER TABLE `W3cCredential` ADD `credential_instances` text NOT NULL DEFAULT '[]';--> statement-breakpoint
UPDATE `W3cCredential` SET `credential_instances` = json_array(
  json_object('credential', `credential`)
);--> statement-breakpoint
ALTER TABLE `W3cCredential` DROP COLUMN `credential`;--> statement-breakpoint

-- W3cV2Credential migration
ALTER TABLE `W3cV2Credential` ADD `credential_instances` text NOT NULL DEFAULT '[]';--> statement-breakpoint
UPDATE `W3cV2Credential` SET `credential_instances` = json_array(
  json_object('credential', `credential`)
);--> statement-breakpoint
ALTER TABLE `W3cV2Credential` DROP COLUMN `credential`;