---
"@credo-ts/openid4vc": patch
---

Adds an `holderBinding` object to the `OpenId4VcIssuanceSessionRecordTransaction`,
allowing you to easily use the holder binding in the deferred credential response
endpoint.

In addition, we now pass the respective `transaction` to `OpenId4VciDeferredCredentialRequestToCredentialMapperOptions`
when called. This simplifies the user logic, since you no longer need to retrieve the transaction manually.
