---
'@credo-ts/core': minor
---

The deprecated `getTrustedCertificatesForVerification` option of the X.509 module is removed, together with `setTrustedCertificatesForVerification` on the `X509ModuleConfig` and the `X509VerificationContext` types. Use the `getTrustedIssuersForVerification` agent config option instead, and return the certificates as `x509` trusted issuers:

```ts
getTrustedIssuersForVerification: async (agentContext, { signer, verification }) => {
  if (signer.method === 'x509' && verification.type === 'oauth2ClientAttestation') {
    return { trustedIssuers: [{ method: 'x509', issuance: [walletProviderCertificate] }] }
  }
}
```

The `trustedCertificates` of the X.509 module are still used when the callback returns no result.
