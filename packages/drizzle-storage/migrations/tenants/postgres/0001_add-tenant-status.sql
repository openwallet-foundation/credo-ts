CREATE TYPE "public"."TenantStatus" AS ENUM('active', 'inactive');--> statement-breakpoint
ALTER TABLE "Tenant" ADD COLUMN "status" "TenantStatus" DEFAULT 'active' NOT NULL;