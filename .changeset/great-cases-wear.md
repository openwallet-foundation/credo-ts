---
'@credo-ts/core': minor
---

- X.509 self-signed certificate creation is now done via the `agent.x509.createCertificate` API where the `subjectPublicKey` is not supplied or equal to the `authorityKey`
- allow to create more complex X.509 certificates
