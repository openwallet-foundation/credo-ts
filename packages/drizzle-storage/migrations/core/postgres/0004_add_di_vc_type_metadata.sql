ALTER TYPE "public"."W3cV2ClaimFormat" ADD VALUE 'di_vc';

ALTER TABLE "W3cV2Credential" ADD COLUMN "cryptosuites" text[];
