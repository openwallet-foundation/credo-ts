-- Mdoc migration
ALTER TABLE "Mdoc" ADD COLUMN "credential_instances" jsonb;--> statement-breakpoint
UPDATE "Mdoc" SET "credential_instances" = jsonb_build_array(
  jsonb_build_object('issuerSignedBase64Url', "base64_url")
);--> statement-breakpoint
ALTER TABLE "Mdoc" DROP COLUMN "base64_url";--> statement-breakpoint
ALTER TABLE "Mdoc" ALTER COLUMN "credential_instances" SET NOT NULL;--> statement-breakpoint

-- SdJwtVc migration
ALTER TABLE "SdJwtVc" ADD COLUMN "credential_instances" jsonb;--> statement-breakpoint
UPDATE "SdJwtVc" SET "credential_instances" = jsonb_build_array(
  jsonb_build_object('compactSdJwtVc', "compact_sd_jwt_vc")
);--> statement-breakpoint
ALTER TABLE "SdJwtVc" DROP COLUMN "compact_sd_jwt_vc";--> statement-breakpoint
ALTER TABLE "SdJwtVc" ALTER COLUMN "credential_instances" SET NOT NULL;--> statement-breakpoint

-- W3cCredential migration
ALTER TABLE "W3cCredential" ADD COLUMN "credential_instances" jsonb;--> statement-breakpoint
UPDATE "W3cCredential" SET "credential_instances" = jsonb_build_array(
  jsonb_build_object('credential', "credential")
);--> statement-breakpoint
ALTER TABLE "W3cCredential" DROP COLUMN "credential";--> statement-breakpoint
ALTER TABLE "W3cCredential" ALTER COLUMN "credential_instances" SET NOT NULL;--> statement-breakpoint

-- W3cV2Credential migration
ALTER TABLE "W3cV2Credential" ADD COLUMN "credential_instances" jsonb;--> statement-breakpoint
UPDATE "W3cV2Credential" SET "credential_instances" = jsonb_build_array(
  jsonb_build_object('credential', "credential")
);--> statement-breakpoint
ALTER TABLE "W3cV2Credential" DROP COLUMN "credential";--> statement-breakpoint
ALTER TABLE "W3cV2Credential" ALTER COLUMN "credential_instances" SET NOT NULL;--> statement-breakpoint

CREATE TYPE "public"."CredentialMultiInstanceState" AS ENUM('SingleInstanceUsed', 'SingleInstanceUnused', 'MultiInstanceFirstUsed', 'MultiInstanceFirstUnused');--> statement-breakpoint
ALTER TABLE "Mdoc" ADD COLUMN "multi_instance_state" "CredentialMultiInstanceState" DEFAULT 'SingleInstanceUsed' NOT NULL;--> statement-breakpoint
ALTER TABLE "SdJwtVc" ADD COLUMN "multi_instance_state" "CredentialMultiInstanceState" DEFAULT 'SingleInstanceUsed' NOT NULL;--> statement-breakpoint
ALTER TABLE "W3cCredential" ADD COLUMN "multi_instance_state" "CredentialMultiInstanceState" DEFAULT 'SingleInstanceUsed' NOT NULL;--> statement-breakpoint
ALTER TABLE "W3cV2Credential" ADD COLUMN "multi_instance_state" "CredentialMultiInstanceState" DEFAULT 'SingleInstanceUsed' NOT NULL;