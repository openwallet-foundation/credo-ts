---
'@credo-ts/didcomm': patch
---

Accept a revocation notification for a credential received through a connection-less exchange. Without a connection, the holder now looks up the credential by its revocation registry id and credential revocation id, and only accepts the notification when it is authcrypted with a key from the `~service` of a message the holder received in that exchange. A credential received over a connection still needs its notification over that connection. Anoncrypted notifications and notifications from any other key are refused.

The notification is trusted as coming from the holder's counterpart in that exchange, the same as over a connection. Treat `revocationNotification` as a hint and check the revocation status list before acting on it.
