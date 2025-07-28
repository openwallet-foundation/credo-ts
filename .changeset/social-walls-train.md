---
"@credo-ts/openid4vc": minor
"@credo-ts/core": minor
---

feat: support multiple presentations for OpenID4VP presentations with DCQL. This is only supported when the query allows 'multiple'. Due to this the API has now changed from a single presentation per query id, to an array of credential ids with at least one entry.
