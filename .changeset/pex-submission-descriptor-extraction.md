---
'@credo-ts/core': patch
---

`extractPresentationsWithDescriptorsFromSubmission` now only accepts a submission descriptor whose `path` resolves to one of the presentations. For JWT and JSON-LD presentations, `path_nested.path` must be `$.verifiableCredential[n]` (JSON-LD) or `$.vp.verifiableCredential[n]` (JWT), and the credential is taken from the credentials of the presentation. Other paths now throw an error. `DifPresentationExchangeService.validatePresentation` evaluates a presentation submission that is passed separately as external, so it checks the credential that `path_nested` points at.
