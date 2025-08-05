---
"@credo-ts/indy-sdk-to-askar-migration": minor
"@credo-ts/question-answer": minor
"@credo-ts/react-native": minor
"@credo-ts/action-menu": minor
"@credo-ts/anoncreds": minor
"@credo-ts/openid4vc": minor
"@credo-ts/indy-vdr": minor
"@credo-ts/didcomm": minor
"@credo-ts/tenants": minor
"@credo-ts/askar": minor
"@credo-ts/cheqd": minor
"@credo-ts/core": minor
"@credo-ts/drpc": minor
"@credo-ts/node": minor
---

when signing in Credo, it is now required to always reference a key id. For DIDs this is extracted from the DidRecord, and for JWKs (e.g. in holder binding) this is extracted form the `kid` of the JWK. For X509 certificates you need to make sure there is a key id attached to the certificate manually for now, since we don't have a X509 record like we have a DidRecord. For x509 certificates created before 0.6 you can use the legacy key id (`certificate.keyId = certificate.publicJwk.legacyKeyId`), for certificates created after 0.6 you need to manually store the key id and set it on the certificate after decoding.

For this reason, we now require instances of X509 certificates where we used to require encoded certificates, to allow you to set the keyId on the certificate beforehand.
