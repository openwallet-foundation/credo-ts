---
"@credo-ts/openid4vc": minor
---

support for creating authorization requests based on `x509_san_uri` client id scheme has been removed. The holder services still support the client id scheme. The client id scheme is removed starting from draft 25 (and replaced with x509_hash, which will be supported in a future version), and is incompatible with the new url structure of Credo.
