---
'@credo-ts/core': patch
---

Update `@owf/cose`, `@owf/token-status-list`, `@owf/mdoc` and `@sd-jwt/*` so they share one version of `@owf/cose`. With two versions, `updateTokenStatusList` could not read a CWT status list.
