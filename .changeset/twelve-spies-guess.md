---
"@credo-ts/core": patch
---

feat: fetch updated sd-jwt-vc type metadata path for sd-jwt-vc. There is also a new `fetchTypeMetadata` method in the `SdJwtVcApi`, allowing to resolve the type metadata for an SD-JWT VC. It will also verify the `vct#integrity` if available on the credential. Only HTTPS urls are supported at the moment.