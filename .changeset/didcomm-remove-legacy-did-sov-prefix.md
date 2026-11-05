---
'@credo-ts/didcomm': minor
---

Remove support for the legacy `did:sov:BzCbsNYhMrjHiqZDTUASHg;spec` message type prefix (Aries RFC 0348). The agent only accepts and sends message types with the `https://didcomm.org` prefix.

- The `useDidSovPrefixWhereAllowed` option is removed from the DIDComm module config. The `allowDidSovPrefix` property is removed from `DidCommMessage`, and `toJSON` does not take options anymore.
- The `replaceLegacyDidSovPrefix` function is removed. The `supportsIncomingMessageType` and `supportsIncomingDidCommProtocolUri` functions do not take the `allowLegacyDidSovPrefixMismatch` option anymore.
- Incoming messages, out of band invitations, credential previews and signature decorators with the legacy prefix are rejected.
- Stored out of band records that contain an invitation with the legacy prefix are still read. The record converts the prefix when it is loaded.
