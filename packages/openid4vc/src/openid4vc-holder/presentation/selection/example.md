# Presentation Submission Example

This document gives an example of the result returned by `PresentationExchangeService.selectCredentialsForRequest`.

On startup of the agent if the wallet does not have a DBC credential yet, it will be added. In the `WalletScreen` I'v added an useEffect with a note that should how you can get the below example results for rendering. There's no way to submit yet, but this is enough to render everything for the proof request.

### Request can be satisfied

The following value represents a presentation that can be satisfied using the following submission. The value `areRequirementsSatisfied: true` indicates that all requirements are met.

Each requirement can contain 1 to N `submissions` entries, where each submission contributes to the requirement. If `isRequirementSatisfied` is `true`, you can render all `submission` entries as a credential on the proof share page.

Each requirement represents a different group (not sure if we want to show this as separate groups, but each group can have a `name` and `purpose`)

```json
{
  "areRequirementsSatisfied": true,
  "requirements": [
    {
      "isRequirementSatisfied": true,
      "needsCount": 1,
      "submission": [
        {
          "inputDescriptorId": "c2834d0e-3c95-4721-b21a-40e3d7ea2549",
          "name": "DBC Conference 2023 Attendee",
          "purpose": "To access this portal your DBC Conference 2023 attendance proof is required.",
          "verifiableCredential": <W3cCredentialRecord>
        }
      ]
    }
  ],
  "purpose": "We want to know your name and e-mail address (will not be stored)"
}
```

### Request could not be satisfied.

The example does not satisfy the requirements. As you can see in `areRequirementsSatisfied: false`. If this is the case you need to loop through all the requirement and for each requirement determine whether the requirement is satisfied (`isRequirementSatisfied: true`). If this is the case you can render the submission entries as is with the succesfull case above. It there's a requirement that is not satisfied (`isRequirementSatisfied: false`), the submission entries will contain a list of submission that entries **that could satisfy the requirement**. However there will be entries where the `verifiableCredential` value is `undefined`.

An example is a requirement that has `needsCount: 3`, but there's only 2 submission entries that could be satisfied. The `submission` list can have a length of 4 . In this case the verifier says: Here's 4 requirements, you can choose any 3 (indicated by `needsCount`) of these submission possiblities. If two submission entries could be satisfied, there will be a list of 4 submission entries, where 2 of them have a `verifiableCredential` value of `undefined`, and two will have a `verifiableCredential` value that can be rendered. This allows the wallet to say you have 2 credentials, but you are missing 1 of these two (and those could include the `name` and `purpose` of that submission so user knows what they need to get to satisfy this request). This is maybe overly complex for now, but so you have at least at the information that is available to show the user exactly why a presentation can't be satisfied. If you want you could also just check `areRequirementsSatisfied: true` and show a general error screen otherwise, but this gives the user less info about what went wrong.

```jsonc
{
  "areRequirementsSatisfied": false,
  "requirements": [
    {
      "isRequirementSatisfied": false,
      "submission": [
        {
          "inputDescriptorId": "c2834d0e-3c95-4721-b21a-40e3d7ea2549",
          "name": "DBC Conference 2023 Attendee",
          "purpose": "To access this portal your DBC Conference 2023 attendance proof is required.",
          "verifiableCredential": <W3cCredentialRecord>
        },
        {
          "inputDescriptorId": "c2834d0e-3c95-4721-b21a-40e3d7ea2549",
          "name": "Not Present",
          "purpose": "We want a credential you don't have"
        }
      ],
      "needsCount": 2
    }
  ],
  "purpose": "We want to know your name and e-mail address (will not be stored)"
}
```
