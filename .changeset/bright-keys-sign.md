---
'@credo-ts/core': minor
'@credo-ts/didcomm': minor
---

Validate JSON-LD credential signing readiness before accepting a proposal or creating a direct or negotiated offer. The preflight checks that the issuer verification method belongs to a DID created by the agent and is compatible with the requested proof type. Capability failures use the typed `W3cJsonLdCredentialSigningNotSupportedError`, allowing callers to choose a negotiation or rejection flow. Signing-time checks also use this error for the same capability failures. When a created DID cannot be found, the typed error wraps the original `RecordNotFoundError` as its cause.
