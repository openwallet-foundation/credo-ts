CREATE TYPE "public"."AnonCredsRevocationRegistryState" AS ENUM('created', 'active', 'full');--> statement-breakpoint
CREATE TABLE "AnonCredsCredential" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"credential_id" text NOT NULL,
	"credential_revocation_id" text,
	"link_secret_id" text NOT NULL,
	"credential" jsonb NOT NULL,
	"method_name" text NOT NULL,
	"credential_definition_id" text NOT NULL,
	"revocation_registry_id" text,
	"schema_id" text NOT NULL,
	"schema_name" text NOT NULL,
	"schema_version" text NOT NULL,
	"schema_issuer_id" text NOT NULL,
	"issuer_id" text NOT NULL,
	CONSTRAINT "anonCredsCredential_pk" PRIMARY KEY("context_correlation_id","id"),
	CONSTRAINT "AnonCredsCredential_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "AnonCredsCredentialDefinition" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"credential_definition_id" text NOT NULL,
	"credential_definition" jsonb NOT NULL,
	"method_name" text NOT NULL,
	"schema_id" text NOT NULL,
	"issuer_id" text NOT NULL,
	"tag" text NOT NULL,
	"unqualified_credential_definition_id" text,
	CONSTRAINT "anonCredsCredentialDefinition_pk" PRIMARY KEY("context_correlation_id","id"),
	CONSTRAINT "AnonCredsCredentialDefinition_credential_definition_id_unique" UNIQUE("credential_definition_id")
);
--> statement-breakpoint
CREATE TABLE "AnonCredsCredentialDefinitionPrivate" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"credential_definition_id" text NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "anonCredsCredentialDefinitionPrivate_pk" PRIMARY KEY("context_correlation_id","id"),
	CONSTRAINT "AnonCredsCredentialDefinitionPrivate_credential_definition_id_unique" UNIQUE("credential_definition_id")
);
--> statement-breakpoint
CREATE TABLE "AnonCredsKeyCorrectnessProof" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"credential_definition_id" text NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "anonCredsKeyCorrectnessProof_pk" PRIMARY KEY("context_correlation_id","id"),
	CONSTRAINT "AnonCredsKeyCorrectnessProof_credential_definition_id_unique" UNIQUE("credential_definition_id")
);
--> statement-breakpoint
CREATE TABLE "AnonCredsLinkSecret" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"link_secret_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"value" text,
	CONSTRAINT "anonCredsLinkSecret_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
CREATE TABLE "AnonCredsRevocationRegistryDefinition" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"revocation_registry_definition_id" text NOT NULL,
	"credential_definition_id" text NOT NULL,
	"revocation_registry_definition" jsonb NOT NULL,
	CONSTRAINT "anonCredsRevocationRegistryDefinition_pk" PRIMARY KEY("context_correlation_id","id"),
	CONSTRAINT "AnonCredsRevocationRegistryDefinition_revocation_registry_definition_id_unique" UNIQUE("revocation_registry_definition_id")
);
--> statement-breakpoint
CREATE TABLE "AnonCredsRevocationRegistryDefinitionPrivate" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"state" "AnonCredsRevocationRegistryState" NOT NULL,
	"revocation_registry_definition_id" text NOT NULL,
	"credential_definition_id" text NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "anonCredsRevocationRegistryDefinitionPrivate_pk" PRIMARY KEY("context_correlation_id","id"),
	CONSTRAINT "AnonCredsRevocationRegistryDefinitionPrivate_revocation_registry_definition_id_unique" UNIQUE("revocation_registry_definition_id")
);
--> statement-breakpoint
CREATE TABLE "AnonCredsSchema" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"schema_id" text NOT NULL,
	"schema" jsonb NOT NULL,
	"issuer_id" text NOT NULL,
	"schema_name" text NOT NULL,
	"schema_version" text NOT NULL,
	"method_name" text NOT NULL,
	"unqualified_schema_id" text,
	CONSTRAINT "anonCredsSchema_pk" PRIMARY KEY("context_correlation_id","id"),
	CONSTRAINT "AnonCredsSchema_schema_id_unique" UNIQUE("schema_id")
);
--> statement-breakpoint
ALTER TABLE "AnonCredsCredential" ADD CONSTRAINT "anonCredsCredential_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AnonCredsCredentialDefinition" ADD CONSTRAINT "anonCredsCredentialDefinition_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AnonCredsCredentialDefinitionPrivate" ADD CONSTRAINT "anonCredsCredentialDefinitionPrivate_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AnonCredsKeyCorrectnessProof" ADD CONSTRAINT "anonCredsKeyCorrectnessProof_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AnonCredsLinkSecret" ADD CONSTRAINT "anonCredsLinkSecret_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AnonCredsRevocationRegistryDefinition" ADD CONSTRAINT "anonCredsRevocationRegistryDefinition_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AnonCredsRevocationRegistryDefinitionPrivate" ADD CONSTRAINT "anonCredsRevocationRegistryDefinitionPrivate_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AnonCredsSchema" ADD CONSTRAINT "anonCredsSchema_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "link_secret_id_context_correlation_id_unique" ON "AnonCredsLinkSecret" USING btree ("link_secret_id","context_correlation_id");