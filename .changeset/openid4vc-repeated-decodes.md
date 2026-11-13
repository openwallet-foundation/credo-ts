---
'@credo-ts/core': patch
'@credo-ts/openid4vc': patch
---

Remove repeated work in OpenID4VC flows. The issuer verifies the `c_nonce` of a batch credential request once instead of once per proof. `MdocRecord` decodes its mdoc once instead of on every `firstCredential` and `getTags` call. The holder stores a received mdoc as the issuer sent it, instead of a re-encoded copy.
