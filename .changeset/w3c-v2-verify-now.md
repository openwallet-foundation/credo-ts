---
'@credo-ts/core': patch
---

Verifying a W3C VC 2.0 credential or presentation (JWT, SD-JWT and Data Integrity) now accepts a `now` option, the date to use as the current time. It applies to the JWT time claims, `validFrom` and `validUntil`, the KB-JWT and the Data Integrity proof `created` and `expires`, and to the credentials in a presentation.
