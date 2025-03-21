---
"@credo-ts/openid4vc": minor
"@credo-ts/core": minor
---

refactor: changed the DIF Presentation Exchnage returned credential entry `type` to `claimFormat` to better align with the DC API. In addition the selected credentials type for DIF PEX was changes from an array of credential records, to an object containig the record, claimFormat and disclosed payload
