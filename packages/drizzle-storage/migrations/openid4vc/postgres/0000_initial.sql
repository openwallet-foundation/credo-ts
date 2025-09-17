CREATE TYPE "public"."OpenId4VcIssuanceSessionState" AS ENUM('OfferCreated', 'OfferUriRetrieved', 'AuthorizationInitiated', 'AuthorizationGranted', 'AccessTokenRequested', 'AccessTokenCreated', 'CredentialRequestReceived', 'CredentialsPartiallyIssued', 'Completed', 'Error');--> statement-breakpoint
CREATE TYPE "public"."OpenId4VcVerificationSessionState" AS ENUM('RequestCreated', 'RequestUriRetrieved', 'ResponseVerified', 'Error');--> statement-breakpoint
CREATE TABLE "Openid4vcIssuer" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"issuer_id" text NOT NULL,
	"access_token_public_key_fingerprint" jsonb,
	"access_token_public_jwk" jsonb,
	"credential_configurations_supported" jsonb NOT NULL,
	"display" jsonb,
	"authorization_server_configs" jsonb,
	"dpop_signing_alg_values_supported" jsonb,
	"batch_credential_issuance" text,
	CONSTRAINT "openid4vcIssuer_pk" PRIMARY KEY("context_correlation_id","id"),
	CONSTRAINT "Openid4vcIssuer_issuer_id_unique" UNIQUE("issuer_id")
);
--> statement-breakpoint
CREATE TABLE "OpenId4VcIssuanceSession" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"issuer_id" text NOT NULL,
	"expires_at" timestamp (3) with time zone,
	"state" "OpenId4VcIssuanceSessionState" NOT NULL,
	"issued_credentials" text[],
	"pre_authorized_code" text,
	"user_pin" text,
	"client_id" text,
	"pkce" jsonb,
	"wallet_attestation" jsonb,
	"dpop" jsonb,
	"authorization" jsonb,
	"presentation" jsonb,
	"issuance_metadata" jsonb,
	"transactions" jsonb,
	"credential_offer_uri" text,
	"credential_offer_id" text,
	"credential_offer_payload" jsonb NOT NULL,
	"generate_refresh_tokens" boolean,
	"error_message" text,
	CONSTRAINT "openId4VcIssuanceSession_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
CREATE TABLE "Openid4vcVerifier" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"verifier_id" text NOT NULL,
	"client_metadata" jsonb,
	CONSTRAINT "openid4vcVerifier_pk" PRIMARY KEY("context_correlation_id","id"),
	CONSTRAINT "Openid4vcVerifier_verifier_id_unique" UNIQUE("verifier_id")
);
--> statement-breakpoint
CREATE TABLE "OpenId4VcVerificationSession" (
	"context_correlation_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"metadata" jsonb,
	"custom_tags" jsonb,
	"verifier_id" text NOT NULL,
	"state" "OpenId4VcVerificationSessionState" NOT NULL,
	"error_message" text,
	"authorization_request_jwt" text,
	"authorization_request_payload" jsonb,
	"authorization_request_uri" text,
	"authorization_response_redirect_uri" text,
	"authorization_request_id" text,
	"expires_at" timestamp (3) with time zone,
	"authorization_response_payload" jsonb,
	"presentation_during_issuance_session" text,
	"nonce" text NOT NULL,
	"payload_state" text,
	CONSTRAINT "openId4VcVerificationSession_pk" PRIMARY KEY("context_correlation_id","id")
);
--> statement-breakpoint
ALTER TABLE "Openid4vcIssuer" ADD CONSTRAINT "openid4vcIssuer_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OpenId4VcIssuanceSession" ADD CONSTRAINT "OpenId4VcIssuanceSession_issuer_id_Openid4vcIssuer_issuer_id_fk" FOREIGN KEY ("issuer_id") REFERENCES "public"."Openid4vcIssuer"("issuer_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OpenId4VcIssuanceSession" ADD CONSTRAINT "openId4VcIssuanceSession_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Openid4vcVerifier" ADD CONSTRAINT "openid4vcVerifier_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OpenId4VcVerificationSession" ADD CONSTRAINT "OpenId4VcVerificationSession_verifier_id_Openid4vcVerifier_verifier_id_fk" FOREIGN KEY ("verifier_id") REFERENCES "public"."Openid4vcVerifier"("verifier_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OpenId4VcVerificationSession" ADD CONSTRAINT "openId4VcVerificationSession_fk_context" FOREIGN KEY ("context_correlation_id") REFERENCES "public"."Context"("context_correlation_id") ON DELETE cascade ON UPDATE no action;