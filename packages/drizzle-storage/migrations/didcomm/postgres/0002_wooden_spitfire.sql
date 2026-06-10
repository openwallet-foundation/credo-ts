ALTER TYPE "public"."DidcommConnectionHandshakeProtocol" ADD VALUE 'None';--> statement-breakpoint
ALTER TYPE "public"."DidcommMediationPickupStrategry" ADD VALUE 'PickUpV3' BEFORE 'Implicit';--> statement-breakpoint
ALTER TYPE "public"."DidcommMediationPickupStrategry" ADD VALUE 'PickUpV3LiveMode' BEFORE 'Implicit';--> statement-breakpoint
ALTER TABLE "DidcommMediation" ADD COLUMN "routing_did" text;--> statement-breakpoint
ALTER TABLE "DidcommMediation" ADD COLUMN "recipient_dids" text[];--> statement-breakpoint
ALTER TABLE "DidcommMediation" ADD COLUMN "mediation_protocol_version" text;