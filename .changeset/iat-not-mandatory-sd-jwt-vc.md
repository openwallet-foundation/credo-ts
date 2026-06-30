---
"@credo-ts/core": patch
---

fix(core): do not automatically set `iat` claim when issuing an SD-JWT VC. Per the latest SD-JWT VC specification both `iat` and `sub` are optional. Issuers that want to include `iat` should now pass it explicitly in the payload.
