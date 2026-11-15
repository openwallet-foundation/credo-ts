---
'@credo-ts/redis-cache': patch
---

Redis cache operations now give up after `operationTimeoutMs` (default 1000), and `get` and `set` treat that as a miss. After a failed or timed out operation, and while ioredis reconnects, `get` and `set` skip Redis for `cooldownMs` (default 5000), so an unreachable Redis slows down one request instead of every one. `remove` always tries Redis. Before, an unreachable Redis held up every cache operation for about 10 seconds. The timeout and the cooldown also apply to a client passed in with the new `client` option, so an app can share its client without changing that client's own retry behaviour.
