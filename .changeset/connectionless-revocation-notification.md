---
'@credo-ts/didcomm': patch
---

Accept a revocation notification for a credential received through a connection-less exchange. Without a connection, the holder now looks up the credential by its revocation registry id and credential revocation id, and checks the notification the same way the credential protocol checks connection-less messages. It must be authcrypted, sent to the key from the holder's own `~service` in that exchange, and sent from a key in the `~service` of the stored credential message. A credential received over a connection still needs its notification over that connection.

The notification is trusted as coming from the holder's counterpart in that exchange, the same as over a connection. Treat `revocationNotification` as a hint and check the revocation status list before acting on it.
