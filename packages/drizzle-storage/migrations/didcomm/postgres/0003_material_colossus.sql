CREATE TYPE "public"."DidcommConnectionVersion" AS ENUM('v1', 'v2');--> statement-breakpoint
ALTER TABLE "DidcommConnection" ADD COLUMN "didcomm_version" "DidcommConnectionVersion";