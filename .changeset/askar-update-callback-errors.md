---
'@credo-ts/askar': patch
---

An error thrown in the `updateByIdWithLock` callback is now rethrown as is, instead of wrapped in an `AskarError`. The record isn't updated.
