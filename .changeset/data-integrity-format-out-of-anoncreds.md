---
"@credo-ts/anoncreds": patch
"@credo-ts/didcomm": patch
---

Move the W3C Data Integrity credential attachment format (Aries RFC 0809) out of `@credo-ts/anoncreds` and into `@credo-ts/didcomm`, where the rest of the format already lived. The format is not anoncreds specific: binding a credential to an anoncreds link secret is one of its binding methods, next to the didcomm signed attachment method and to not binding the credential at all. Issuing a plain W3C credential over this format no longer requires depending on `@credo-ts/anoncreds`.

- Added `DidCommDataIntegrityCredentialFormatService` to `@credo-ts/didcomm`. `DataIntegrityDidCommCredentialFormatService` in `@credo-ts/anoncreds` is now a deprecated alias for it and will be removed in the next major version.
- Added the `DidCommDataIntegrityLinkSecretBindingProvider` interface and its injection token, implementing the `anoncreds_link_secret` binding method. `@credo-ts/anoncreds` provides `AnonCredsLinkSecretBindingProvider` and the `AnonCredsModule` registers it, so agents using anoncreds keep the binding method with no changes. Using the binding method without the `AnonCredsModule` registered now fails with an explanatory error rather than an unresolved dependency.
- Fixed `deleteCredentialById` deleting every credential of this format through the anoncreds holder service. Credentials that were not bound to a link secret are now removed as the plain `W3cCredentialRecord` or `W3cV2CredentialRecord` they are stored as.
