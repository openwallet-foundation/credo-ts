CREATE TYPE "public"."DidcommConnectionVersion" AS ENUM('v1', 'v2');--> statement-breakpoint
ALTER TYPE "public"."DidcommConnectionHandshakeProtocol" ADD VALUE 'None';--> statement-breakpoint
ALTER TYPE "public"."DidcommMediationPickupStrategry" ADD VALUE 'PickUpV3' BEFORE 'Implicit';--> statement-breakpoint
ALTER TYPE "public"."DidcommMediationPickupStrategry" ADD VALUE 'PickUpV3LiveMode' BEFORE 'Implicit';--> statement-breakpoint
ALTER TABLE "DidcommBasicMessage" ADD COLUMN "protocol_version" text;--> statement-breakpoint
ALTER TABLE "DidcommConnection" ADD COLUMN "didcomm_version" "DidcommConnectionVersion";--> statement-breakpoint
ALTER TABLE "DidcommMediation" ADD COLUMN "routing_did" text;--> statement-breakpoint
ALTER TABLE "DidcommMediation" ADD COLUMN "recipient_dids" text[];--> statement-breakpoint
ALTER TABLE "DidcommMediation" ADD COLUMN "protocol_version" text;