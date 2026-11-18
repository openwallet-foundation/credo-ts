---
'@credo-ts/core': patch
---

Verifying a W3C VC 2.0 Data Integrity credential now checks `validFrom` and `validUntil`, like the JWT and SD-JWT paths already did. The result is only valid when all validations pass. Before, an expired or not-yet-valid credential was accepted.

A `validFrom` or `validUntil` that is not a parseable date, such as a `:60` leap second, now fails validation in the JWT, SD-JWT and Data Integrity paths. Before, it was ignored.
