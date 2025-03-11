---
"@credo-ts/openid4vc": minor
"@credo-ts/core": minor
---

The mdoc device response now verifies each document separately based on the trusted certificates callback. This ensures only the trusted certificates for that specific document are used. In addition, only ONE document per device response is supported for openid4vp verifications from now on, this is expected behaviour according to ISO 18013-7
