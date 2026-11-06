---
'@credo-ts/core': patch
---

Update `@owf/cose` and `@owf/token-status-list` to `^0.7.0`, `@owf/mdoc` to `^0.9.3`, and `@sd-jwt/core` and `@sd-jwt/sd-jwt-vc` to `^0.24.3`, so they all use one version of `@owf/cose`. `@owf/mdoc` 0.9.3 moved to `@owf/cose` 0.7, and with two versions installed, `updateTokenStatusList` could not read a CWT status list that `createTokenStatusList` created.
