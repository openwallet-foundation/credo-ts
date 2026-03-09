---
"@credo-ts/openid4vc": patch
---

You can now customize the grace period during which an issuance session is kept alive after the deferral interval has passed by defining `deferralIntervalGracePeriodInSeconds` (default is 7 days).

Note that this only applies to deferrals happening after upgrading Credo. For sessions deferred before updating Credo, the previous expiry date will remain unless the issuance is deferred once more.
