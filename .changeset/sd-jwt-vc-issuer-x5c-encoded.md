---
'@credo-ts/core': minor
---

The `x5c` of the `issuer` of a decoded SD-JWT VC now holds the encoded certificates from the header, instead of `X509Certificate` instances. Decoding no longer parses the certificates, so an invalid certificate is reported when the SD-JWT VC is verified. Parse them with `agent.x509.parseCertificate` when needed. The trusted issuer callbacks also get the parsed chain as `signer.certificateChain`.

`SdJwtVcService.applyDisclosuresForPayload` and `SdJwtVcService.applyDisclosuresForPaths` are removed.
