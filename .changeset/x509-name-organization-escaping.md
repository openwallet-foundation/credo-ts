---
'@credo-ts/core': patch
---

The issuer and subject objects for X.509 certificates, CSRs and CRLs now support `organizationName` (`O`) and `organizationIdentifier` (OID 2.5.4.97). Values are now escaped according to RFC 4514. Before, a comma in a value split it into another attribute. A value can't end with a backslash, because `@peculiar/x509` can't parse it.

```ts
await agent.x509.createCertificate({
  authorityKey,
  issuer: {
    commonName: 'Example Root',
    countryName: 'NL',
    organizationName: 'Example Org, Inc.',
    organizationIdentifier: 'NTRNL-12345678',
    organizationalUnit: 'Engineering',
  },
})
```
