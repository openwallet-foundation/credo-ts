---
'@credo-ts/drizzle-storage': patch
---

Add the columns for DIDComm v2 support: `didcomm_version` on the `DidcommConnection` table (with the handshake protocol value `None`), `routing_did`, `recipient_dids` and `protocol_version` on the `DidcommMediation` table (with the pickup strategies `PickUpV4` and `PickUpV4LiveMode`), and `protocol_version` on the `DidcommBasicMessage` table. Make sure to run the migrations for the `didcomm` bundle. All columns are nullable and existing rows read as v1.
