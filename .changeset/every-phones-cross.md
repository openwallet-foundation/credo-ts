---
"@credo-ts/openid4vc": patch
"@credo-ts/core": patch
---

feat: add a (configurable) 30 seconds skew to JWT-based credentials and other JWT object verification. This is to prevent verification errors based on slight deviations in server time. This does not affect non-JWT credentials yet (mDOC, JSON-LD)
