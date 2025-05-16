---
"@credo-ts/redis-cache-nodejs": patch
"@credo-ts/didcomm": patch
"@credo-ts/core": patch
---

- Added a new package to use `redis` for caching in Node.js
- Add a new open `useCache` to a record, which allows to CRUD the cache before calling the storage service
  - This is only set to `true` on the `connectionRecord` is it is used a couple times in a row a lot of the time
