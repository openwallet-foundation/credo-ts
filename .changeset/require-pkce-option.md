---
'@credo-ts/openid4vc': patch
---

Change the default for `pkceRequired` to `true`. By default PKCE MUST be required unless it is overridden on `OpenId4VcIssuerModule` or on individual issuance sessions