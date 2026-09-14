---
"@credo-ts/openid4vc": patch
---

Allow the `getDynamicIssuanceSession` callback to supply the `id` of the issuance session to create. A dynamic issuance session is created after the callback returns, so the callback could not previously know the id of the session it just authorized. Supplying it lets an external system reference the session before it exists, for example to record it in its own database while handling the same request. When omitted a random id is generated, as before.
