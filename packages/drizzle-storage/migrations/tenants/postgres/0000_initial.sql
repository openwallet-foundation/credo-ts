CREATE TABLE "Tenant" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"storage_version" text,
	"config" jsonb NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "tenant_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
CREATE TABLE "TenantRouting" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"tenant_id" text NOT NULL,
	"recipient_key_fingerprint" text NOT NULL,
	CONSTRAINT "tenantRouting_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
ALTER TABLE "Tenant" ADD CONSTRAINT "tenant_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TenantRouting" ADD CONSTRAINT "tenantRouting_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "TenantRouting" ADD CONSTRAINT "TenantRouting_tenant_id_context_correlation_id_Tenant_id_context_correlation_id_fk" FOREIGN KEY ("tenant_id","context_correlation_id") REFERENCES "public"."Tenant"("id","context_correlation_id") ON DELETE cascade ON UPDATE no action;