---
'@credo-ts/openid4vc': patch
---

Setting `requireDpop` or `requireWalletAttestation` to `false` when creating a credential offer or in the `getDynamicIssuanceSession` callback now disables the requirement for the issuance session, even if it is required in the global config. Previously `false` fell back to the global config value. To keep using the global config value, omit the option (or set it to `undefined`).
