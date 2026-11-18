ALTER TABLE "MdocVerificationSession" ALTER COLUMN "session_key_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "MdocVerificationSession" ADD COLUMN "session_key" jsonb;