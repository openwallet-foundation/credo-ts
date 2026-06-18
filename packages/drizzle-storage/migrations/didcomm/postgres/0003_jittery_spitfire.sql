ALTER TABLE "DidcommMediation" ALTER COLUMN "pickup_strategy" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."DidcommMediationPickupStrategry";--> statement-breakpoint
CREATE TYPE "public"."DidcommMediationPickupStrategry" AS ENUM('PickUpV1', 'PickUpV2', 'PickUpV2LiveMode', 'PickUpV4', 'PickUpV4LiveMode', 'Implicit', 'None');--> statement-breakpoint
ALTER TABLE "DidcommMediation" ALTER COLUMN "pickup_strategy" SET DATA TYPE "public"."DidcommMediationPickupStrategry" USING "pickup_strategy"::"public"."DidcommMediationPickupStrategry";