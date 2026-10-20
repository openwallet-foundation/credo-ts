---
"@credo-ts/openid4vc": patch
---

Add configurable DPoP support for chained upstream authorization servers, including KMS key selection and nonce continuity. In strict mode (`required: true`), DPoP must be supported and usable by the upstream server, and the returned access token's `cnf.jkt` must match the DPoP key. In tolerant mode (`required: false`), DPoP is used when available, but unsupported or unusable DPoP falls back to requests without DPoP, and the access token's `cnf.jkt` is not enforced.
