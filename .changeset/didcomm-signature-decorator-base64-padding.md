---
'@credo-ts/didcomm': patch
---

Signature decorators whose `sig_data` or `signature` is encoded as padded base64url or standard base64 are now accepted, instead of failing with `Signature is not valid`. The value is decoded as base64url first (with padding stripped) and falls back to standard base64, matching how signed attachment data is decoded since #2761 and invitation urls since #2960. The error thrown when decoding genuinely fails now also carries the underlying error as its `cause`, which was previously discarded.
