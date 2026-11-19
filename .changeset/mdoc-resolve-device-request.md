---
'@credo-ts/core': minor
---

Add `resolveDeviceRequest` and `createDeviceResponse` to the mdoc module, to answer a device request that the application received over a channel it handles itself, such as ISO/IEC 18013-5 proximity (BLE, NFC or Wi-Fi Aware). They work like `resolveDcApiRequest` and `createDcApiResponse`, and share their matching and response logic.

- `resolveDeviceRequest` takes the `DeviceRequest` the application decrypted from its session and the `SessionTranscript` of that session. It verifies the reader authentication of every doc request over the session transcript, checks the reader certificate chains through the same trust layers as the DC API, and matches the doc requests against the stored mdocs. The resolved request has the same `useCases` and `docRequests` as a resolved DC API request, with `deviceRequest` and `sessionTranscript` in place of `origin` and `parsedRequest`.
- The `getTrustedIssuersForVerification` callback is called with `exchange: { type: 'deviceRequest' }` in the `mdocReaderAuth` verification for these requests.
- `createDeviceResponse` returns an `MdocDeviceResponse` signed over the session transcript. It is not encrypted, so the application encrypts it for its session. The result of `selectCredentialsForRequest` can be passed to it as is.

Breaking:

- The `exchange` of the `mdocReaderAuth` verification (`VerificationTypeMdocReaderAuth`, which the deprecated x509 `getTrustedCertificatesForVerification` callback receives as `X509VerificationTypeMdocReaderAuth`) is now `{ type: 'dcApi'; origin: string } | { type: 'deviceRequest' }`. Check `exchange.type` before reading `exchange.origin`.

```ts
// Before
if (verification.type === 'mdocReaderAuth') {
  return getTrustedReadersForOrigin(verification.exchange.origin)
}

// After
if (verification.type === 'mdocReaderAuth' && verification.exchange.type === 'dcApi') {
  return getTrustedReadersForOrigin(verification.exchange.origin)
}
```
