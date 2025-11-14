---
"@credo-ts/core": minor
---

- DidCommV2Service is now LegacyDidCommV2Service, and NewDidCommV2Service became the default DidCommV2Service now
- DidDocumentService.protocolScheme() has been removed, as it's not possible from the base did document service class to determine the protocol scheme. It needs to be implemented on a specific did document service class.
