---
"@credo-ts/anoncreds": patch
"@credo-ts/core": patch
"@credo-ts/didcomm": patch
---

Support issuing Verifiable Credentials Data Model 2.0 credentials over the W3C Data Integrity credential attachment format (Aries RFC 0809). The format previously advertised `data_model_versions_supported: ['1.1']` and rejected a data model 2.0 credential, even though the agent was already able to secure one with a `DataIntegrityProof`.

The data model version is negotiated on the wire as the RFC describes: the offer advertises the version of the credential it carries, and the holder echoes its choice as `data_model_version` on the request. Which cryptosuite secures the credential is not negotiated, as RFC 0809 leaves that choice to the issuer.

- The base JSON-LD context of the offered credential now determines the advertised `data_model_versions_supported`, so offering a credential in the `https://www.w3.org/ns/credentials/v2` context works without further configuration. Offers for data model 1.1 credentials are unaffected.
- Added the `cryptosuite` data integrity credential format option, naming the Data Integrity cryptosuite used to secure a data model 2.0 credential, for example `eddsa-jcs-2022`. When omitted, the first registered cryptosuite supporting the key type of the issuer verification method is used. It is ignored for data model 1.1, which is secured with a linked data signature suite instead. The `anoncreds-2023` cryptosuite is rejected, as it is only produced through the anoncreds link secret binding method.
- `W3cDataIntegrityApi.getSupportedCryptosuites` accepts an optional public JWK type, returning only the cryptosuites that support that key type.
- A received data model 2.0 credential is verified and stored as a `W3cV2CredentialRecord`. Deleting a credential of this format looks the record up in both the data model 1.1 and 2.0 stores, so the record type on the credential exchange record stays `'w3c'` for both versions.
- The anoncreds link secret binding method is rejected for data model 2.0 credentials, both when creating an offer and when issuing, as that binding method is defined for data model 1.1 and the `anoncredsvc-2023` cryptosuite only.
