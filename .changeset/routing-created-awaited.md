---
'@credo-ts/didcomm': patch
---

`DidCommRoutingService.getRouting` now waits for async listeners of the routing created event. With the tenants module, a tenant's new routing keys are therefore registered before an invitation or connection that uses them is returned. Before, a message sent to those keys could arrive first and fail with "Couldn't determine tenant id".
