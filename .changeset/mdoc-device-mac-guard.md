---
"@credo-ts/core": patch
---

fix(mdoc): guard unsupported device MAC authentication in the mdoc context

The `hdkf` callback in the mdoc context previously derived an ECDH shared secret using raw curve math over the raw device private key bytes passed to it as a callback argument. This code path is only reached for mdoc device MAC authentication (ISO/IEC 18013-5), which Credo does not currently implement (only device signature authentication is supported), so it was never exercised. It is now replaced with an explicit error. A future device MAC implementation must derive the shared secret from the wallet-managed key inside the KMS, since the previous callback contract is incompatible with a non-exportable, KMS-held device key.
