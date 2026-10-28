---
'@credo-ts/core': minor
---

The deprecated `MdocDeviceResponse.createDeviceResponseWithDcqlQuery`, `MdocService.createDcqlQueryDeviceResponse` and `MdocDeviceResponseDcqlQueryOptions` are removed. Use `DcqlService.createPresentation`, or `MdocDeviceResponse.createDeviceResponse` with explicit `documentRequests`.

For DIF Presentation Exchange, the id of an mdoc input descriptor is its doctype, as ISO 18013-7 specifies, so an id like `mDL` no longer requests the mDL. An mdoc that lacks an optional data element can now be presented, and `intent_to_retain` defaults to `false`. `MdocDeviceResponse.limitDisclosureToInputDescriptor` returns no data elements instead of throwing when the input descriptor requests none.
