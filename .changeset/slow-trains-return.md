---
"@credo-ts/openid4vc": minor
"@credo-ts/core": minor
---

fixed an issue where expectedUpdate in an mdoc would be set to undefined. This is a breaking change as previously issued mDOCs containing expectedUpdate values of undefined are not valid anymore, and will cause issues during verification
