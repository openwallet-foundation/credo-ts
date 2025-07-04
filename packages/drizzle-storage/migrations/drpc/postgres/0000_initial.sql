CREATE TYPE "public"."DidcommDrpcState" AS ENUM('request-sent', 'request-received', 'completed');--> statement-breakpoint
CREATE TYPE "public"."DidcommDrpcRole" AS ENUM('client', 'server');--> statement-breakpoint
CREATE TABLE "DidcommDrpc" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"request" jsonb,
	"response" jsonb,
	"state" "DidcommDrpcState" NOT NULL,
	"role" "DidcommDrpcRole" NOT NULL,
	"connection_id" text NOT NULL,
	"thread_id" text NOT NULL,
	CONSTRAINT "didcommDrpc_pk" PRIMARY KEY("context_correlation_id","id"),
	CONSTRAINT "DidcommDrpc_context_correlation_id_thread_id_unique" UNIQUE("context_correlation_id","thread_id")
);
--> statement-breakpoint
ALTER TABLE "DidcommDrpc" ADD CONSTRAINT "didcommDrpc_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DidcommDrpc" ADD CONSTRAINT "DidcommDrpc_connection_id_context_correlation_id_DidcommConnection_id_context_correlation_id_fk" FOREIGN KEY ("connection_id","context_correlation_id") REFERENCES "public"."DidcommConnection"("id","context_correlation_id") ON DELETE cascade ON UPDATE no action;