---
'@credo-ts/core': minor
---

`agent.sdJwtVc.present` only takes a decoded `SdJwtVc`, no longer a compact string. Decode one with `agent.sdJwtVc.fromCompact`. A KB-JWT for a credential bound to a jwk needs the `kmsKeyId` of the holder key on that `SdJwtVc`, and `SdJwtVcRecord.fromSdJwtVc` throws for such a credential without it. Before, Credo fell back to the legacy key id, so an issuer could bind a credential to another key of the holder that is stored under its legacy key id. Credentials received through the OpenID4VCI holder have the `kmsKeyId` set, and records stored before `kmsKeyId` existed still use the legacy key id.
