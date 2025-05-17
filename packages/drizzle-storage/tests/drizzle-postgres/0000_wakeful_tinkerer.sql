CREATE TYPE "public"."DidcommConnectionHandshakeProtocol" AS ENUM('https://didcomm.org/didexchange/1.x', 'https://didcomm.org/connections/1.x');--> statement-breakpoint
CREATE TYPE "public"."DidcommConnectionRole" AS ENUM('requester', 'responder');--> statement-breakpoint
CREATE TYPE "public"."DidcommConnectionState" AS ENUM('start', 'invitation-sent', 'invitation-received', 'request-sent', 'request-received', 'response-sent', 'response-received', 'abandoned', 'completed');--> statement-breakpoint
CREATE TABLE "GenericRecord" (
	"context_correlation_id" text NOT NULL,
	"id" text,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"content" jsonb NOT NULL,
	CONSTRAINT "GenericRecord_context_correlation_id_id_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
CREATE TABLE "SdJwtVc" (
	"context_correlation_id" text NOT NULL,
	"id" text,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"vct" text NOT NULL,
	"alg" text NOT NULL,
	"sd_alg" text NOT NULL,
	"compact_sd_jwt_vc" text NOT NULL,
	CONSTRAINT "SdJwtVc_context_correlation_id_id_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
CREATE TABLE "Mdoc" (
	"context_correlation_id" text NOT NULL,
	"id" text,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"base64_url" text NOT NULL,
	"alg" text NOT NULL,
	"doc_type" text NOT NULL,
	CONSTRAINT "Mdoc_context_correlation_id_id_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
CREATE TABLE "StorageVersion" (
	"context_correlation_id" text NOT NULL,
	"id" text,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"storage_version" text NOT NULL,
	CONSTRAINT "StorageVersion_context_correlation_id_id_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
CREATE TABLE "DidcommConnection" (
	"context_correlation_id" text NOT NULL,
	"id" text,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"state" "DidcommConnectionState" NOT NULL,
	"role" "DidcommConnectionRole" NOT NULL,
	"did" text,
	"their_did" text,
	"their_label" text,
	"alias" text,
	"auto_accept_connection" boolean,
	"image_url" text,
	"thread_id" text,
	"invitation_did" text,
	"mediator_id" text,
	"out_of_band_id" text,
	"error_message" text,
	"protocol" "DidcommConnectionHandshakeProtocol",
	"connection_types" text[],
	"previous_dids" text[],
	"previous_their_dids" text[],
	CONSTRAINT "DidcommConnection_context_correlation_id_id_pk" PRIMARY KEY("context_correlation_id","id"),
	CONSTRAINT "DidcommConnection_thread_id_unique" UNIQUE("thread_id")
);
