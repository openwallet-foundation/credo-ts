CREATE TYPE "public"."DidcommBasicMessageRole" AS ENUM('sender', 'receiver');--> statement-breakpoint
CREATE TYPE "public"."DidcommConnectionState" AS ENUM('start', 'invitation-sent', 'invitation-received', 'request-sent', 'request-received', 'response-sent', 'response-received', 'abandoned', 'completed');--> statement-breakpoint
CREATE TYPE "public"."DidcommConnectionRole" AS ENUM('requester', 'responder');--> statement-breakpoint
CREATE TYPE "public"."DidcommConnectionHandshakeProtocol" AS ENUM('https://didcomm.org/didexchange/1.x', 'https://didcomm.org/connections/1.x');--> statement-breakpoint
CREATE TYPE "public"."DidcommCredentialExchangeState" AS ENUM('proposal-sent', 'proposal-received', 'offer-sent', 'offer-received', 'declined', 'request-sent', 'request-received', 'credential-issued', 'credential-received', 'done', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."DidcommCredentialExchangeRole" AS ENUM('issuer', 'holder');--> statement-breakpoint
CREATE TYPE "public"."DidcommCredentialExchangeAutoAccept" AS ENUM('always', 'contentApproved', 'never');--> statement-breakpoint
CREATE TYPE "public"."DidcommMessageRole" AS ENUM('sender', 'receiver');--> statement-breakpoint
CREATE TYPE "public"."DidcommMediationState" AS ENUM('requested', 'granted', 'denied');--> statement-breakpoint
CREATE TYPE "public"."DidcommMediationRole" AS ENUM('MEDIATOR', 'RECIPIENT');--> statement-breakpoint
CREATE TYPE "public"."DidcommMediationPickupStrategry" AS ENUM('PickUpV1', 'PickUpV2', 'PickUpV2LiveMode', 'Implicit', 'None');--> statement-breakpoint
CREATE TYPE "public"."DidcommOutOfBandRole" AS ENUM('sender', 'receiver');--> statement-breakpoint
CREATE TYPE "public"."DidcommOutOfBandState" AS ENUM('initial', 'await-response', 'prepare-response', 'done');--> statement-breakpoint
CREATE TYPE "public"."DidcommProofExchangeRole" AS ENUM('verifier', 'prover');--> statement-breakpoint
CREATE TYPE "public"."DidcommProofExchangeState" AS ENUM('proposal-sent', 'proposal-received', 'request-sent', 'request-received', 'presentation-sent', 'presentation-received', 'declined', 'abandoned', 'done');--> statement-breakpoint
CREATE TYPE "public"."DidcommProofExchangeAutoAccept" AS ENUM('always', 'contentApproved', 'never');--> statement-breakpoint
CREATE TABLE "DidcommBasicMessage" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"content" text NOT NULL,
	"sent_time" text NOT NULL,
	"role" "DidcommBasicMessageRole" NOT NULL,
	"connection_id" text,
	"thread_id" text,
	"parent_thread_id" text,
	CONSTRAINT "didcommBasicMessage_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
CREATE TABLE "DidcommConnection" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
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
	CONSTRAINT "didcommConnection_pk" PRIMARY KEY("context_correlation_id","id"),
	CONSTRAINT "DidcommConnection_context_correlation_id_thread_id_unique" UNIQUE("context_correlation_id","thread_id")
);
--> statement-breakpoint
CREATE TABLE "DidcommCredentialExchange" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"connection_id" text,
	"thread_id" text NOT NULL,
	"parent_thread_id" text,
	"state" "DidcommCredentialExchangeState" NOT NULL,
	"role" "DidcommCredentialExchangeRole" NOT NULL,
	"auto_accept_credential" "DidcommCredentialExchangeAutoAccept",
	"revocation_notification" jsonb,
	"error_message" text,
	"protocol_version" text,
	"credentials" jsonb,
	"credential_ids" text[],
	"credential_attributes" jsonb,
	"linked_attachments" jsonb,
	CONSTRAINT "didcommCredentialExchange_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
CREATE TABLE "DidcommMessage" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"message" jsonb NOT NULL,
	"role" "DidcommMessageRole" NOT NULL,
	"associated_record_id" text,
	"thread_id" text NOT NULL,
	"protocol_name" text NOT NULL,
	"message_name" text NOT NULL,
	"protocol_major_version" text NOT NULL,
	"protocol_minor_version" text NOT NULL,
	CONSTRAINT "didcommMessage_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
CREATE TABLE "DidcommMediation" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"state" "DidcommMediationState" NOT NULL,
	"role" "DidcommMediationRole" NOT NULL,
	"connection_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"endpoint" text,
	"recipient_keys" text[] NOT NULL,
	"routing_keys" text[] NOT NULL,
	"pickup_strategy" "DidcommMediationPickupStrategry",
	"default" boolean,
	CONSTRAINT "didcommMediation_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
CREATE TABLE "DidcommMediatorRouting" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"routing_keys" jsonb NOT NULL,
	"routing_key_fingerprints" text[] NOT NULL,
	CONSTRAINT "didcommMediatorRouting_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
CREATE TABLE "DidcommOutOfBand" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"out_of_band_invitation" jsonb NOT NULL,
	"role" "DidcommOutOfBandRole" NOT NULL,
	"state" "DidcommOutOfBandState" NOT NULL,
	"alias" text,
	"reusable" boolean NOT NULL,
	"auto_accept_connection" boolean,
	"mediator_id" text,
	"reuse_connection_id" text,
	"invitation_inline_service_keys" jsonb,
	"thread_id" text NOT NULL,
	"invitation_requests_thread_ids" text[],
	"recipient_key_fingerprints" text[],
	"recipient_routing_key_fingerprint" text,
	CONSTRAINT "didcommOutOfBand_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
CREATE TABLE "DidcommProofExchange" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"connection_id" text,
	"thread_id" text NOT NULL,
	"protocol_version" text NOT NULL,
	"parent_thread_id" text,
	"is_verified" boolean,
	"state" "DidcommProofExchangeRole" NOT NULL,
	"role" "DidcommProofExchangeRole" NOT NULL,
	"auto_accept_proof" "DidcommProofExchangeAutoAccept",
	"error_message" text,
	CONSTRAINT "didcommProofExchange_pk" PRIMARY KEY("context_correlation_id","id"),
	CONSTRAINT "DidcommProofExchange_context_correlation_id_thread_id_role_unique" UNIQUE("context_correlation_id","thread_id","role")
);
--> statement-breakpoint
ALTER TABLE "DidcommBasicMessage" ADD CONSTRAINT "didcommBasicMessage_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DidcommBasicMessage" ADD CONSTRAINT "DidcommBasicMessage_connection_id_context_correlation_id_DidcommConnection_id_context_correlation_id_fk" FOREIGN KEY ("connection_id","context_correlation_id") REFERENCES "public"."DidcommConnection"("id","context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DidcommConnection" ADD CONSTRAINT "didcommConnection_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DidcommCredentialExchange" ADD CONSTRAINT "didcommCredentialExchange_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DidcommMessage" ADD CONSTRAINT "didcommMessage_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DidcommMediation" ADD CONSTRAINT "didcommMediation_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DidcommMediation" ADD CONSTRAINT "DidcommMediation_connection_id_context_correlation_id_DidcommConnection_id_context_correlation_id_fk" FOREIGN KEY ("connection_id","context_correlation_id") REFERENCES "public"."DidcommConnection"("id","context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DidcommMediatorRouting" ADD CONSTRAINT "didcommMediatorRouting_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DidcommOutOfBand" ADD CONSTRAINT "didcommOutOfBand_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DidcommProofExchange" ADD CONSTRAINT "didcommProofExchange_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DidcommProofExchange" ADD CONSTRAINT "DidcommProofExchange_connection_id_context_correlation_id_DidcommConnection_id_context_correlation_id_fk" FOREIGN KEY ("connection_id","context_correlation_id") REFERENCES "public"."DidcommConnection"("id","context_correlation_id") ON DELETE cascade ON UPDATE no action;