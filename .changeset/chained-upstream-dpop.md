---
"@credo-ts/openid4vc": patch
---

Add configurable DPoP support for chained upstream authorization servers, including KMS key selection and nonce continuity. In strict mode (`required: true`), DPoP must be supported and usable by the upstream server, and the token response must identify the access token as DPoP-bound with `token_type: "DPoP"`. JWT access tokens are verified, and opaque tokens are introspected, to confirm they are active and their `cnf.jkt` matches the DPoP key. Opaque tokens are rejected if introspection is unavailable, reports them inactive, or omits `cnf.jkt`. In tolerant mode (`required: false`), DPoP is used when available, but unsupported or unusable DPoP falls back to requests without DPoP, and the token response type is not enforced.
