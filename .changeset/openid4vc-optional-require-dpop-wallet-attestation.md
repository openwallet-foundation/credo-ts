---
'@credo-ts/openid4vc': patch
---

The `requireDpop` and `requireWalletAttestation` options in `authorization` object when creating a credential offer are now optional.

If not provided (`undefined`) or `false`, the global config value is used.

In the next breaking release (0.8.0) `false` will disable the requirement for the issuance session. If you currently use `false` to fall back to the global config value, update it to `undefined` instead.
