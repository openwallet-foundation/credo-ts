---
"@credo-ts/webvh": patch
---

fix(webvh): bump didwebvh-ts version to 2.7.4. This solves a hash calculation bug that makes previous DIDs created with this library incompatible with the spec. As a result, DIDs created with previous versions of Credo will fail to resolve. See https://github.com/decentralized-identity/didwebvh-ts/issues/93.
