---
"@credo-ts/openid4vc": patch
---

fix(openid4vc): loosen validation for multi-validation credential request. Some wallets send both `credential_configuration_id` and `format` which should not cause an error
