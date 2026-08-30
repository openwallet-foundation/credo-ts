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
- Reader authentication on an incoming request is resolved through the same trust layers as
  credential verification: the certificates passed to `resolveDcApiRequest`, then the global
  `getTrustedIssuersForVerification` callback (with the new `mdocReaderAuth` verification type,
  called per doc request), then the deprecated `getTrustedCertificatesForVerification` callback,
  then the statically configured trusted certificates. Resolving a reader authenticated request
  throws when none of these are configured. Return the leaf certificate from the callback to trust
  a reader on the certificate it presented itself.
