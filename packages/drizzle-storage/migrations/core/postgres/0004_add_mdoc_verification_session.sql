CREATE TYPE "public"."MdocVerificationSessionState" AS ENUM('Error', 'RequestCreated', 'ResponseVerified');--> statement-breakpoint
CREATE TYPE "public"."MdocVerificationSessionTranscriptType" AS ENUM('isoMdocDcApi');--> statement-breakpoint
CREATE TABLE "MdocVerificationSession" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"state" "MdocVerificationSessionState" NOT NULL,
	"error_message" text,
	"device_request_base64_url" text NOT NULL,
	"session_transcript" jsonb NOT NULL,
	"session_transcript_type" "MdocVerificationSessionTranscriptType" NOT NULL,
	"nonce" text,
	"session_key_id" text NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "mdocVerificationSession_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
ALTER TABLE "MdocVerificationSession" ADD CONSTRAINT "mdocVerificationSession_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;