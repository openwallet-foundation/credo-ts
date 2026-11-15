---
'@credo-ts/redis-cache': patch
---

Fixes in the Redis cache:

- A client from another copy of ioredis is now used, instead of being taken as options for a new client on `localhost:6379`.
- An expiry that isn't a whole number of seconds is rounded up. Before, Redis rejected it and the entry wasn't stored.
- `destroy` now removes the entries when ioredis' `keyPrefix` is set, and no longer removes entries of other contexts when the context id contains glob characters.
- Connection errors of a client the cache created no longer go to the console. Failed operations are still logged with the agent's logger.
