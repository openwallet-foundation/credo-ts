---
'@credo-ts/core': patch
---

The default JSON-LD document loader now fetches remote documents with the agent's fetch, so the agent's `fetchLimits` and a custom fetch in the agent dependencies also apply to JSON-LD contexts. Set `maxDocumentBytes` on the `JsonLdModule` to override the size limit. The JSON-LD document loader and the SD-JWT VC status list fetcher now only fetch `https` urls, unless `allowInsecureHttpUrls` is enabled. The document loader also rejects a redirect to an url that isn't allowed. Errors for a failed status list fetch no longer include the response body.
