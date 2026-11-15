---
'@credo-ts/redis-cache': patch
---

The Redis cache no longer sends a `PING` before every command, so a cache read or write takes one round trip instead of two. `disconnect` now resolves once the connection has closed.
