---
'@credo-ts/didcomm': minor
'@credo-ts/anoncreds': minor
---

Remove the deprecated DIDComm v1 protocols: Connection (RFC 0160), Issue Credential v1 (RFC 0036) and Present Proof v1 (RFC 0037).

`@credo-ts/didcomm`:

- The agent does not register or advertise the `https://didcomm.org/connections/1.0` protocol anymore. Use the DID Exchange protocol (`DidCommHandshakeProtocol.DidExchange`) to create connections.
- The `DidCommConnectionInvitationMessage`, `DidCommConnectionRequestMessage`, `DidCommConnectionResponseMessage` and `DidCommConnectionProblemReportMessage` classes, their handlers, the `DidCommConnectionRole` and `DidCommConnectionState` enums, `DidCommHandshakeProtocol.Connections` and `DidCommInvitationType.Connection` are removed.
- The `createLegacyInvitation` method is removed from the out of band API. `receiveInvitation` only accepts a `DidCommOutOfBandInvitation`. The agent does not parse invitation URLs with a `c_i` query parameter anymore. Legacy connectionless invitations (`d_m` query parameter) are still supported.
- The `imageUrl` option is removed from the receive and accept invitation methods of the out of band API. Only the connection protocol used this value.
- The `rfc0160State` getter is removed from `DidCommConnectionRecord`.
- The `DidCommConnectionService` does not contain the `createRequest`, `processRequest`, `createResponse`, `processResponse`, `processAck` and `processProblemReport` methods anymore.
- The storage migration from version 0.1 to 0.2 still migrates connection records that were created with the connection protocol.

`@credo-ts/anoncreds`:

- The `DidCommCredentialV1Protocol` and `DidCommProofV1Protocol` classes and their messages are removed from `@credo-ts/anoncreds/didcomm`. Use `DidCommCredentialV2Protocol` and `DidCommProofV2Protocol` from `@credo-ts/didcomm` instead. The `LegacyIndyDidCommCredentialFormatService` and `LegacyIndyDidCommProofFormatService` can still be used with the v2 protocols.
