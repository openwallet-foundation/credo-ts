---
'@credo-ts/openid4vc': patch
---

The holder now ignores the `client_id` of an unsigned DC API request, as required by OpenID4VP. Before, a web page could set the `client_id` to another verifier, and the wallet used it as the verifier and as the audience of SD-JWT and JWT presentations.
