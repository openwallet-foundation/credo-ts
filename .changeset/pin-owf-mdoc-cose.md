---
'@credo-ts/core': patch
---

Pin `@owf/mdoc` to `<0.8.3`. `@owf/mdoc@0.8.3` depends on `@owf/cose@0.5.0` while core uses `@owf/cose@0.4.x`; the two copies register different COSE tag decoders on the shared `cbor-x`, which made `updateTokenStatusList({ format: 'cwt' })` fail to decode its own token.
