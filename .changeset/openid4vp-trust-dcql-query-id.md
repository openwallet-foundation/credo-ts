---
'@credo-ts/openid4vc': patch
'@credo-ts/core': patch
---

The `openId4VpCredential` verification passed to `getTrustedIssuersForVerification` now includes `dcql`: the DCQL query and the id of the credential query the credential was presented for. Decide trust on the query, not on the credential's `vct`. A query also matches an SD-JWT VC whose type metadata extends a requested `vct`, and any issuer can publish such type metadata. When the verifier resolved that type metadata, the SD-JWT VC has it as `typeMetadata` and `typeMetadataChain`.

```ts
const getTrustedIssuersForVerification: GetTrustedIssuersForVerification<VerificationSigner, OpenId4VcVerificationTypes> =
  async (agentContext, { verification }) => {
    if (verification.type === 'openId4VpCredential' && verification.dcql?.credentialQueryId === 'pid') {
      return { trustedIssuers: [{ method: 'x509', issuance: [pidIssuerCertificate] }] }
    }

    return undefined
  }
```
