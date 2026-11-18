---
'@credo-ts/openid4vc': patch
---

The OpenID4VCI issuer and the OpenID4VP verifier now check under a record lock that a session still allows a change before they make it. They also only write the fields the request changed. Before, concurrent requests could each pass the state check and overwrite each other. Two token requests with the same code could both get an access token, two requests for the same credential could both issue it, and parallel requests for different credentials could lose credentials that were already issued.

A request that arrives after the session finished, or that loses a race, now gets an error and leaves the session unchanged. Before, it could move a completed session to `Error`. A credential request for a finished session or for a credential that was already issued gets `credential_request_denied` instead of `invalid_credential_request` or a server error. A deferred credential request for a session in `Error` gets `credential_request_denied` instead of `invalid_transaction_id`. These requests, and a request for an unknown transaction, throw the new `OpenId4VcIssuanceSessionStateError` and don't move the session to `Error`, so a duplicate request doesn't stop the other credentials of the session from being issued. A duplicate authorization response no longer gets the `redirect_uri` when another response ended the session. The verifier throws the new `OpenId4VcVerificationSessionFinishedError` for it.

Changes that the `credentialRequestToCredentialMapper`, `deferredCredentialRequestToCredentialMapper`, `getVerificationSession` or `getChainedAuthorizationRequestParameters` callbacks make to the issuance session are no longer stored.

A deferred credential request with an access token for another subject than the one bound to the session now gets `invalid_transaction_id` instead of `credential_request_denied`. That is the same response as for an unknown session, so it doesn't reveal that the session exists.

This needs storage with record locking, such as Postgres. For storage backends that don't support locking (SQLite) it will still fetch the record immediately before updating, so it reduces the change for race conditions. For servers handling concurrent requests it's always recommended to use postgres.