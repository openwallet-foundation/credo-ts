---
'@credo-ts/drizzle-storage': patch
'@credo-ts/askar': patch
'@credo-ts/core': patch
'@credo-ts/node': patch
---

Add support for the ISO/IEC TS 18013-7:2025 Annex C (`org-iso-mdoc`) Digital Credentials API.

- KMS: HPKE (RFC 9180) key agreement algorithms `HPKE-0`, `HPKE-3` and `HPKE-7`, following the
  naming of draft-ietf-jose-hpke-encrypt. These are integrated-encryption algorithms, so
  `encryption`/`decryption` must be omitted and `encrypt` returns an `encapsulatedKey`. Implemented
  in the askar backend (the recipient private key stays inside askar; only the Diffie-Hellman output
  leaves it) and in the node backend.
- Mdoc module: `createDcApiVerificationSession` / `verifyDcApiResponse` for verifiers and
  `resolveDcApiRequest` / `createDcApiResponse` for wallets, backed by a new
  `MdocVerificationSessionRecord`.
- `verifyDcApiResponse` matches the response against the device request of the session and throws
  a `MdocDeviceRequestNotSatisfiedError` when a doc request is not satisfied. By default every
  requested element must be disclosed and issuer signed; in the `docRequests` passed to
  `createDcApiVerificationSession`, pass `{ intentToRetain, optional, source }` instead of the
  `intentToRetain` boolean to mark an element as optional or as device signed. The match is returned
  as `deviceRequestMatch`, with per doc request the valid and failed documents, and per document the
  result of the `docType` and `claims` checks.
- `resolveDcApiRequest` matches the stored mdocs with the same rules and returns the same structure
  (through `Holder.matchDeviceRequest` of `@owf/mdoc`): per doc request the `validCredentials` and
  `failedCredentials`, each with its `record` and the `docType` and `claims` checks, so a wallet can
  show an mdoc of the requested doctype together with the requested claims it is missing. An
  `age_over_NN` request is answered with the age attestation the mdoc has (18013-5 7.2.5). A
  requested element that is not issuer signed, but that the device key is authorized for in the
  MSO, is matched as device signed: pass its value in the `deviceNameSpaces` of the credential to
  `createDcApiResponse`. A credential can also pass `elements` to disclose only some of the
  requested elements.
- Reader authentication on an incoming request is resolved through the same trust layers as
  credential verification: the certificates passed to `resolveDcApiRequest`, then the global
  `getTrustedIssuersForVerification` callback (with the new `mdocReaderAuth` verification type,
  called per doc request), then the deprecated `getTrustedCertificatesForVerification` callback,
  then the statically configured trusted certificates. Resolving a reader authenticated request
  throws when none of these are configured. Return the leaf certificate from the callback to trust
  a reader on the certificate it presented itself.
