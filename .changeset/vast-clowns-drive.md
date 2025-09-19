---
"@credo-ts/openid4vc": minor
---

The openid4vc modules have been merged into a single module for easier setup.

You can now add the `OpenId4VcModule` to your agent and config the `issuer` and `verifier` config on it. If the config for `issuer` or `verifier` is enabled, that submodule will be activated, and can be accessed on the API of the OpenId4VcModule.

For convencience we now also expose the openid4vc module under the `openid4vc` property directly on the agent (instead of under `agent.modules`), but only if the module is registered under the `openid4vc` module key.

For example if before you were using `agent.modules.openId4VcIssuer.xxx` you can now write this as `agent.openid4vc.issuer.xxx` after upgrading to the combined `OpenId4VcModule`. The old modules are still availalbe, but you should remove these from your module regisration in favour of the new `OpenId4VcModule`.
