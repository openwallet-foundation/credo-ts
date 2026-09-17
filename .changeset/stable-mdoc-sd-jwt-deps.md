---
"@credo-ts/core": patch
"@credo-ts/openid4vc": patch
---

Update to stable releases of `@owf/mdoc` (0.8.0), `@owf/cose` (0.4.0) and `@owf/token-status-list` (0.4.0), to `@sd-jwt/core` and `@sd-jwt/sd-jwt-vc` 0.21.0, and to `@openid4vc/*` 0.5.6. SD-JWT processing is now stricter: a compact SD-JWT must end with the `~` separator, disclosure salts must be unique within an SD-JWT, and the `sub` claim of a status list token must equal the `uri` that references it.
