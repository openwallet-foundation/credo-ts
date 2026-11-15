---
'@credo-ts/openid4vc': patch
---

- A credential request for a `Completed` or `Error` issuance session returns `credential_request_denied` and leaves the session unchanged.
- A deferred credential no longer moves a session from `CredentialsPartiallyIssued` back to `CredentialRequestReceived`.
