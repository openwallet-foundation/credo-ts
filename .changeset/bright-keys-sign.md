---
'@credo-ts/core': patch
'@credo-ts/didcomm': patch
---

Validate JSON-LD credential signing readiness before accepting a proposal or creating a direct or negotiated offer. The preflight checks that the issuer verification method belongs to a DID created by the agent and is compatible with the requested proof type. This requires a created DID record and a resolvable issuer DID document earlier in the exchange, at offer creation or proposal acceptance, rather than waiting until request acceptance. Capability failures use the typed `W3cJsonLdCredentialSigningNotSupportedError`, allowing callers to choose a negotiation or rejection flow. Signing-time checks also use this error for the same capability failures. When a created DID or verification method cannot be found, the typed error wraps the original error as its cause.
