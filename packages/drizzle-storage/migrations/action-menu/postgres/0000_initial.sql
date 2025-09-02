CREATE TYPE "public"."DidcommActionMenuState" AS ENUM('null', 'awaiting-root-menu', 'preparing-root-menu', 'preparing-selection', 'awaiting-selection', 'done');--> statement-breakpoint
CREATE TYPE "public"."DidcommActionMenuRole" AS ENUM('requester', 'responder');--> statement-breakpoint
CREATE TABLE "DidcommActionMenu" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"state" "DidcommActionMenuState" NOT NULL,
	"role" "DidcommActionMenuRole" NOT NULL,
	"connection_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"menu" jsonb,
	"performed_action" jsonb,
	CONSTRAINT "didcommActionMenu_pk" PRIMARY KEY("context_correlation_id","id"),
	CONSTRAINT "DidcommActionMenu_context_correlation_id_thread_id_unique" UNIQUE("context_correlation_id","thread_id")
);
--> statement-breakpoint
ALTER TABLE "DidcommActionMenu" ADD CONSTRAINT "didcommActionMenu_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DidcommActionMenu" ADD CONSTRAINT "DidcommActionMenu_connection_id_context_correlation_id_DidcommConnection_id_context_correlation_id_fk" FOREIGN KEY ("connection_id","context_correlation_id") REFERENCES "public"."DidcommConnection"("id","context_correlation_id") ON DELETE cascade ON UPDATE no action;