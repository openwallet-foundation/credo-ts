---
'@credo-ts/core': minor
---

SD-JWT VC type metadata fetched by the default resolver is now cached in the agent cache. A document with `vct#integrity` can't change and is cached for 24 hours. Any other document is cached for the `max-age` of the `Cache-Control` header of its response, up to one hour, and not at all without one or with `private`. Set the maximum with `typeMetadataCacheExpirySeconds` in the `SdJwtVcModule` config, where 0 disables the cache.
