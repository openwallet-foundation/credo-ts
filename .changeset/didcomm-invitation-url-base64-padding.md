---
'@credo-ts/didcomm': patch
---

Invitation URLs whose `oob`, `c_i` or `d_m` parameter is encoded as padded base64url or standard base64 are now accepted, instead of failing with `Could not decode data from base64url string`. The encoded value is decoded as base64url first (with padding stripped) and falls back to standard base64, matching how signed attachment data is decoded since #2761.
