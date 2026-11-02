---
"@credo-ts/openid4vc": patch
---

Add configurable DPoP support for chained authorization servers. Credo uses DPoP whenever the authorization server advertises support; `dpop.keyId` can select the KMS key and `dpop.signingAlgValuesSupported` can restrict signing algorithms. In strict mode (`dpop.required: true`), authorization fails if the server does not advertise DPoP support. In tolerant mode (`dpop.required: false`, the default), authorization continues without DPoP when the server does not advertise support. If DPoP is advertised but Credo cannot create a compatible proof, the request fails rather than silently falling back. When DPoP is used, the token response must use `token_type: "DPoP"`. This follows RFC 9449 Sections 5 and 5.1 (DPoP access-token requests and authorization-server metadata) and 8 (authorization-server-provided nonces).

The DPoP key is created on the first authorization request (PAR or authorization challenge) and stored on the issuance session, so later requests reuse it. Generated keys are deleted with their session unless `deleteIssuanceSessionById` is called with `deleteChainedDpopKey: false`. Keys set with `dpop.keyId` are never deleted. A session that started authorization without upstream DPoP support can't switch to DPoP later.
