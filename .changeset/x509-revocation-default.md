---
'@credo-ts/core': patch
---

X.509 certificate chain validation now checks revocation by default (`SoftFail` for the full chain), as documented for the `revocationCheck` option of the X509 module. Set `revocationCheck: { mode: X509RevocationCheckMode.Disabled }` to turn it off. Revocation options passed to `checkCertificateRevocation` or `fetchCertificateRevocationList` now use the module's `revocationCheck` for any option they don't set.
