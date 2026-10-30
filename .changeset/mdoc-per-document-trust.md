---
'@credo-ts/openid4vc': patch
---

The OpenID4VP verifier now gets the trusted certificates for each document of an mdoc device response from that document's own certificate chain and doc type. Before, it used the first document for all of them, so with a `getTrustedIssuersForVerification` or `getTrustedCertificatesForVerification` callback, a document could be verified against the issuers trusted for another document in the same response. This only affects Presentation Exchange responses with multiple documents in one device response. DCQL already rejected those.
