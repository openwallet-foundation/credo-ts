---
'@credo-ts/openid4vc': patch
---

The `requireDpop` and `requireWalletAttestation` options in `authorization` when creating a credential offer are now optional. If not provided, the global config value is used. Currently `false` also falls back to the global config value, but in 0.8.0 `false` will disable the requirement for the issuance session. If you pass `false` to use the global config value, update it to `undefined` (or omit it).
