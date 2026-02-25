CREATE TYPE "public"."W3cV2ClaimFormat" AS ENUM('vc+sd-jwt', 'vc+jwt');--> statement-breakpoint
CREATE TABLE "W3cV2Credential" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"credential" jsonb NOT NULL,
	"issuer_id" text NOT NULL,
	"subject_ids" text[] NOT NULL,
	"schema_ids" text[] NOT NULL,
	"contexts" text[] NOT NULL,
	"types" text[] NOT NULL,
	"given_id" text,
	"claim_format" "W3cV2ClaimFormat" NOT NULL,
	"algs" text[],
	CONSTRAINT "w3cV2Credential_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
ALTER TABLE "W3cV2Credential" ADD CONSTRAINT "w3cV2Credential_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;