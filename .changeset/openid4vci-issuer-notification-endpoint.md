---
'@credo-ts/openid4vc': minor
---

The OpenID4VCI issuer now has a notification endpoint (`/notification`, configurable with `endpoints.notification`) and advertises it as `notification_endpoint` in the credential issuer metadata. Credential responses with credentials include a `notification_id`. When a wallet sends a notification, the event is stored in `notifications` on the issuance session and an `OpenId4VcIssuerEvents.IssuanceSessionNotificationReceived` event is emitted. Only the first notification per `notification_id` counts. A repeat of the same event gets a success response. A different event gets an `invalid_notification_request` error. The endpoint is enabled by default. Set `enableNotificationEndpoint: false` to turn it off, for example when you delete issuance sessions once issuance is done. `Openid4vciSendNotificationError`, which `holder.sendNotification` throws when the issuer returns an error response, is now exported.
