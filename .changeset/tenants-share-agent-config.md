---
'@credo-ts/tenants': minor
'@credo-ts/core': minor
---

Tenants now share the `AgentConfig` of the root agent instead of getting their own copy. A `getTrustedIssuersForVerification` callback set on the root agent with `setTrustedIssuersForVerification` now also applies to tenants, the same as module configuration. Setting the callback on a tenant now also changes it for the root agent and all other tenants. Use the `agentContext` passed to the callback to return different trusted issuers per tenant. `AgentConfig.extend` is removed, as nothing used it anymore.
