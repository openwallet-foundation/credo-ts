---
"@credo-ts/redis-cache": patch
"@credo-ts/didcomm": patch
"@credo-ts/core": patch
---

- Added a new package to use `redis` for caching in Node.js
- Add a new option `allowCache` to a record, which allows to CRUD the cache before calling the storage service
  - This is only set to `true` on the `connectionRecord` and mediation records for now, improving the performance of the mediation flow
