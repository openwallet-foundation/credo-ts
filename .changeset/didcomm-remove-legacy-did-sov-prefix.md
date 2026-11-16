---
'@credo-ts/didcomm': minor
---

Remove support for the legacy `did:sov:BzCbsNYhMrjHiqZDTUASHg;spec` message type prefix (Aries RFC 0348). The agent only accepts and sends message types with the `https://didcomm.org` prefix.

- The `useDidSovPrefixWhereAllowed` option is removed from the DIDComm module config. The `allowDidSovPrefix` property is removed from `DidCommMessage`, and `toJSON` does not take options anymore.
- The `replaceLegacyDidSovPrefix` function is removed. The `supportsIncomingMessageType` and `supportsIncomingDidCommProtocolUri` functions do not take the `allowLegacyDidSovPrefixMismatch` option anymore.
- Incoming messages, out of band invitations, credential previews and signature decorators with the legacy prefix are rejected.
- Stored out of band records that contain an invitation with the legacy prefix are still read. The record converts the prefix when it is loaded.

Credo / AFJ 0.1.0 and later and ACA-Py 0.11.0 and later send the `https://didcomm.org` prefix by default. ACA-Py 0.5.5 to 0.10.x need the `--emit-new-didcomm-prefix` flag. Agents configured with `useLegacyDidSovPrefix` or `useDidSovPrefixWhereAllowed` set to `true` must turn it off.
