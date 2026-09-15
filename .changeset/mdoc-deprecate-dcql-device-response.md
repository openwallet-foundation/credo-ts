---
"@credo-ts/core": patch
---

chore(mdoc): deprecate `MdocDeviceResponse.createDeviceResponseWithDcqlQuery` and `MdocService.createDcqlQueryDeviceResponse`

Credo does not use these methods itself, and they only support part of DCQL: every claim of every `mso_mdoc` credential query is requested, `credential_sets`, `claim_sets` and `values` are ignored, and a claim missing from the mdoc throws instead of being treated as optional. Use `DcqlService.createPresentation` to present mdocs for a DCQL query, or `createDeviceResponse` with explicit `documentRequests`.
