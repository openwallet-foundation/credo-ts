---
'@credo-ts/didcomm': patch
---

Fixed sending a connection-less message on a new thread, such as `sendRevocationNotification` for a credential issued through an out-of-band invitation with `handshake: false`. It failed with `Unable to determine keyId for jwk`, because the `~service` of the last sent message has no kms key id. The sender key id is now taken from the out-of-band record that was created with that key.
