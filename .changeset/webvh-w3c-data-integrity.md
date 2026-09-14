---
"@credo-ts/webvh": patch
---

Migrate `WebVhAnonCredsRegistry` proof creation/verification to use the core `W3cDataIntegrityApi` instead of a vendored `eddsa-jcs-2022` cryptosuite. This removes the duplicated cryptosuite implementation from `@credo-ts/webvh` in favor of `@credo-ts/core`'s W3C VC Data Integrity module.
