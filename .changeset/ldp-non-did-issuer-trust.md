---
"@credo-ts/core": patch
---

Verifying a JSON-LD (`ldp_vc`) credential now fails when the issuer is not a DID, such as an `https` URL. Before, these credentials skipped the trusted issuer check. All other credential formats already required a DID or X.509 issuer.
