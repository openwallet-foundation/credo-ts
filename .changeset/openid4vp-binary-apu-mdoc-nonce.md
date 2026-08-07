---
"@credo-ts/openid4vc": patch
"@credo-ts/core": patch
---

fix(openid4vc): don't fail encrypted OpenID4VP response verification when the wallet sends a non-UTF-8 (binary) JARM `apu` header. The `apu` bytes are now kept as-is and only interpreted as a UTF-8 `tstr` where they are actually used: the ISO 18013-7 / OpenID4VP draft 18 mdoc session transcript.
