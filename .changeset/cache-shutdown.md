---
'@credo-ts/core': patch
'@credo-ts/redis-cache': patch
---

A cache can implement `shutdown`, which the agent calls when it shuts down. The Redis cache closes the client it created then. A client passed in stays open, as it belongs to the app.
