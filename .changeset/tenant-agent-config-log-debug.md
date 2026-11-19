---
'@credo-ts/core': patch
'@credo-ts/tenants': patch
'@credo-ts/openid4vc': patch
'@credo-ts/didcomm': patch
---

Log levels follow one rule: info is for lifecycle and administrative events, and anything logged per request or per message is debug.

- The `Creating agent with config` log is written at debug for tenant agents. The root agent still logs it at info.
- The DIDComm `Automatically sending ... with autoAccept` logs are written at debug instead of info.
- OpenID4VC error responses with a status below 500 are logged at info instead of warn. A presentation that fails verification is logged at debug, since its reason is in the error response log.
- Deleting a tenant, updating a tenant's storage and shutting down the agent are logged at info.
