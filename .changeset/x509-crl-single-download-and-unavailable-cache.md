---
'@credo-ts/core': minor
---

Concurrent revocation checks that need the same CRL now share one download and parse.

After 3 failed downloads in a row, a CRL distribution point is treated as unavailable for 10 seconds, so checks don't each wait for the timeout. After that, one download is tried again. Set the period with `crlUnavailableCacheExpirySeconds`, or 0 to disable it.
