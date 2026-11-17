CREATE TYPE "public"."didStatus" AS ENUM('active', 'deactivated');--> statement-breakpoint
ALTER TABLE "Did" ADD COLUMN "status" "didStatus";--> statement-breakpoint
UPDATE "Did" SET "status" = 'active';