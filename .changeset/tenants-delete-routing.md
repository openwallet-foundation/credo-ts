---
'@credo-ts/tenants': patch
---

When a tenant deletes DIDComm routing keys, the tenant routing records for those keys are now deleted as well, so they no longer grow with every deleted connection or invitation.
