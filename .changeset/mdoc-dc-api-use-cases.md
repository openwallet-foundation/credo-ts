---
'@credo-ts/core': minor
---

Support the request information of ISO/IEC TS 23220-4 (taken up by the second edition of ISO/IEC 18013-5) in the ISO mdoc DC API, by updating `@owf/mdoc` to `^0.9.0`, `@owf/*` to `^0.5.0` and `@sd-jwt/*` to `^0.23.1`.

Verifier:

- `createDcApiVerificationSession` takes `deviceRequestInfo.useCases`, which say which doc requests the response has to answer, and `requestInfo` per doc request with alternative elements, accepted issuers (`issuerIdentifiers`, hex encoded authority key identifiers), `uniqueDocSetRequired` and `maximumResponseSize`. Accepted issuers are matched against the certificate chain each document was verified with.
- Use cases are only sent when passed, and then set the device request version to `1.1`. Wallets that do not support them ignore them. `treatAmbiguousMultipleDocRequestsAsAlternatives` is ignored when use cases are passed.

```ts
await agent.mdoc.createDcApiVerificationSession({
  docRequests: [mdlDocRequest, passportDocRequest, residencePermitDocRequest],
  // an mDL, or a passport and a residence permit
  deviceRequestInfo: { useCases: [{ mandatory: true, documentSets: [[0], [1, 2]] }] },
})
```

- `MdocDeviceResponse.verify` returns per document its `documentIndex`, the verified `mdoc` and the `trustedIssuanceChain` it was verified with, instead of nothing.

Wallet:

- New `agent.mdoc.selectCredentialsForRequest` selects the credentials to answer a resolved request with, like `selectCredentialsForDcqlRequest`: the first matching document set of every mandatory use case (or, without mandatory use cases, of the first use case that can be answered), the first credential per doc request that can be used with `useMode`, and per claim its first option, including the alternative sets and device signed values that takes. For a resolved DC API request the result can be passed to `createDcApiResponse` as is.
- `createDcApiResponse` takes several doc request indexes in `docRequestIndex`, to answer several doc requests of a credential's docType with a single document.
- `createDcApiResponse` takes `alternatives` per credential, to disclose an alternative set in place of a requested element. The claim `options` in the resolved request list the sets an mdoc can disclose. It throws when the credentials do not answer the use cases of the request.

```ts
const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })
if (resolved.success) {
  const response = await agent.mdoc.createDcApiResponse(agent.mdoc.selectCredentialsForRequest(resolved))
}
```

Breaking:

- The resolved request of `resolveDcApiRequest` replaces `docRequestsAsAlternatives` with `useCasesSource` and `useCases`, and the `deviceRequestMatch` of `verifyDcApiResponse` changes the same way. For a request without use cases, `useCasesSource` is `'allDocRequests'` (was `docRequestsAsAlternatives: false`), or `'eachDocRequest'` with `treatAmbiguousMultipleDocRequestsAsAlternatives` (was `docRequestsAsAlternatives: true`). For a request with use cases it is `'deviceRequestInfo'`, and a successful request can have doc requests without a valid credential: use `useCases[].matchingDocumentSets` to see which doc requests to answer, or `selectCredentialsForRequest`.

```ts
// Before
if (resolved.success && !resolved.docRequestsAsAlternatives) {
  // every doc request has a valid credential
}

// After
if (resolved.success && resolved.useCasesSource === 'allDocRequests') {
  // every doc request has a valid credential
}
```

- The resolved request types drop `DcApi` from their name, as they do not depend on the DC API: `MdocResolvedDocRequest(Success|Failure)`, `MdocValidCredential`, `MdocFailedCredential` and `MdocCredentialMatch`. `MdocDcApiResolvedRequest` extends the new `MdocResolvedRequest`.
