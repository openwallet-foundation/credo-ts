---
'@credo-ts/core': minor
---

Decoding an SD-JWT VC now needs the agent context, so the certificates in its `x5c` header are parsed through the X.509 module of the agent.

- `SdJwtVcRecord.firstCredential` is replaced by `SdJwtVcRecord.getFirstCredential(agentContext)`.
- `SdJwtVcService.fromCompact` takes the `agentContext` as its first argument. `agent.sdJwtVc.fromCompact` is unchanged.
- `SdJwtVcService.applyDisclosuresForPayload` and `SdJwtVcService.applyDisclosuresForPaths` are removed.
