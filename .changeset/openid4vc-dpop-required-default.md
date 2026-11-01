---
'@credo-ts/openid4vc': minor
---

The OpenID4VC issuer now requires DPoP by default. Set `dpopRequired: false` in the issuer module config, or `requireDpop: false` for a single issuance session, to keep the old behaviour.

An issuer now supports DPoP with all signature algorithms of the agent's KMS when `dpopSigningAlgValuesSupported` isn't set. Before, DPoP was unsupported then. Set `dpopSigningAlgValuesSupported` in the issuer module config to limit the algorithms for all issuers, or on the issuer record for a single issuer. The token, pushed authorization request and authorization challenge endpoints now reject DPoP proofs signed with other algorithms.
