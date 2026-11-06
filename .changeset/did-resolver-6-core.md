---
'@credo-ts/core': minor
---

Upgrade `did-resolver` to 6.0.0 and `web-did-resolver` to 3.2.0. DID URLs are now parsed strictly according to DID Core v1.0: `parseDid` and `tryParseDid` reject legacy matrix parameters (`;key=value`), unencoded characters outside the RFC 3986 sets in path, query and fragment, and invalid percent escapes, and resolution of such DIDs returns `invalidDid`. `ParsedDid` no longer has a `params` property. `did:web` resolution now validates the host, returns no document when its `id` does not match the DID, and reports `resolutionError` for network, HTTP and JSON failures (`notFound` only for HTTP 404 and `id` mismatches). Requests use the agent's injected fetch with Credo's timeout helper; `web-did-resolver` requires Node.js 22 or later.
