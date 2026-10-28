---
'@credo-ts/core': minor
'@credo-ts/anoncreds': patch
'@credo-ts/didcomm': minor
'@credo-ts/openid4vc': minor
---

DIF Presentation Exchange now uses `presentation-exchange` instead of `@animo-id/pex`.

`getCredentialsForRequest` now returns a `DifPexQueryResult`, shaped like the DCQL query result. For each input descriptor it lists the matching credentials, and the non-matching ones with the reasons, so a wallet can show what is missing. It replaces `DifPexCredentialsForRequest`. In the OpenID4VP holder, `presentationExchange.credentialsForRequest` is now `presentationExchange.queryResult`.

```ts
const { queryResult } = resolved.presentationExchange

if (queryResult.can_be_satisfied) {
  const credentials = agent.openid4vc.holder.selectCredentialsForPresentationExchangeRequest(queryResult)
} else {
  // Each entry has the `record` and the `reasons`, e.g. { type: 'field', paths: ['$.birthdate'], cause: 'path_not_found' }
  const missing = queryResult.input_descriptors.flatMap((inputDescriptor) => inputDescriptor.non_matching_credentials)
}
```

The members of `DifPresentationExchangeSubmissionLocation` are renamed to `External` and `Presentation`, with the string values `'external'` and `'presentation'`. A filter's `type` must be a JSON Schema type name, so a definition declared as a plain object may need `satisfies DifPresentationExchangeDefinitionV2`.

Presentation definitions are checked more strictly:

- Field paths only support `.name`, `['name']`, `[0]` and `[*]`. Filters only support `type`, `const`, `enum`, `format`, lengths and bounds, and `not`, `contains` and `items` one level deep. A definition that uses anything else, such as `..` or `pattern`, is rejected.
- A string `minimum` or `maximum`, such as a date bound, is now applied.
- The `format` of the presentation definition now restricts the credentials too, including its algorithms and proof types.
- An input descriptor that requires `is_holder`, `same_subject` or a status can't be satisfied, as Credo doesn't check these. AnonCreds credentials still satisfy `statuses`.
- In a v1 definition, a credential must match every `schema` entry with `required: true`.
- A filter on an mdoc data element compares its JSON value, such as a date as its `YYYY-MM-DD` string.

When presenting, a credential that matches several input descriptors discloses for each only what that input descriptor asks for, and a wildcard path discloses every element that matches its filter. `createPresentation` checks the selected credentials against their input descriptors, and an SD-JWT VC needs the `External` submission location. A JWT VP is signed with an algorithm the `jwt_vp` format allows. `selectCredentialsForRequest` supports `from_nested`, and respects `count` and `max` when an input descriptor is in several groups.
