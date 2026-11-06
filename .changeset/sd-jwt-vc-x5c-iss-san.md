---
'@credo-ts/core': minor
---

SD-JWT VCs signed with an X.509 certificate no longer require the `iss` claim to be an HTTPS URI that matches a SAN URI or SAN DNS name in the leaf certificate, for both signing and verifying. The SD-JWT VC draft dropped these requirements.

Do not rely on the `iss` value for any means of trust when verifying an SD-JWT VC signed with an X509 certificate.
