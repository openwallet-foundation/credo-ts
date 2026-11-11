ALTER TABLE "OpenId4VcIssuanceSession" ADD COLUMN "notifications" jsonb;--> statement-breakpoint
ALTER TABLE "OpenId4VcIssuanceSession" ADD COLUMN "notification_ids" text[];