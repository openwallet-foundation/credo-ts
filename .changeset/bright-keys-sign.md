---
'@credo-ts/core': patch
'@credo-ts/didcomm': patch
---

Validate JSON-LD credential signing readiness at offer creation and issuance. When accepting a proposal, creating a direct offer, or creating a negotiated offer, Credo checks that the issuer verification method belongs to a DID created by the agent and is compatible with the requested proof type. The signing path also performs these checks when it issues the credential.
