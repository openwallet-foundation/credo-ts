---
'@credo-ts/core': patch
---

`getDomainFromUrl` now parses the URL with `URL` and throws for URLs that contain a username or password. Before, `https://good.example:x@evil.example` returned `good.example`. The domain is used to match an OpenID4VP response URL against the SAN DNS names of an x5c certificate.
