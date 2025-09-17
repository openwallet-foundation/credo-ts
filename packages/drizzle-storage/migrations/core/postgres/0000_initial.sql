CREATE TYPE "public"."didRole" AS ENUM('created', 'received');--> statement-breakpoint
CREATE TYPE "public"."W3cClaimFormat" AS ENUM('ldp_vc', 'jwt_vc');--> statement-breakpoint
CREATE TABLE "Context" (
	"context_correlation_id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Did" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"did" text NOT NULL,
	"role" "didRole" NOT NULL,
	"did_document" jsonb,
	"keys" jsonb,
	"recipient_key_fingerprints" jsonb,
	"method" text NOT NULL,
	"method_specific_identifier" text NOT NULL,
	"alternative_dids" text[],
	CONSTRAINT "did_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
CREATE TABLE "GenericRecord" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"content" jsonb NOT NULL,
	CONSTRAINT "genericRecord_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
CREATE TABLE "Mdoc" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"base64_url" text NOT NULL,
	"alg" text NOT NULL,
	"doc_type" text NOT NULL,
	CONSTRAINT "mdoc_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
CREATE TABLE "SdJwtVc" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"vct" text NOT NULL,
	"alg" text NOT NULL,
	"sd_alg" text NOT NULL,
	"compact_sd_jwt_vc" text NOT NULL,
	CONSTRAINT "sdJwtVc_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
CREATE TABLE "SingleContextLruCache" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"entries" jsonb NOT NULL,
	CONSTRAINT "singleContextLruCache_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
CREATE TABLE "StorageVersion" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"storage_version" text NOT NULL,
	CONSTRAINT "storageVersion_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
CREATE TABLE "W3cCredential" (
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
	"claim_format" "W3cClaimFormat" NOT NULL,
	"proof_types" text[],
	"crypto_suites" text[],
	"algs" text[],
	"expanded_types" text[],
	CONSTRAINT "w3cCredential_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
ALTER TABLE "Did" ADD CONSTRAINT "did_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "GenericRecord" ADD CONSTRAINT "genericRecord_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Mdoc" ADD CONSTRAINT "mdoc_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SdJwtVc" ADD CONSTRAINT "sdJwtVc_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SingleContextLruCache" ADD CONSTRAINT "singleContextLruCache_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "StorageVersion" ADD CONSTRAINT "storageVersion_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "W3cCredential" ADD CONSTRAINT "w3cCredential_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;