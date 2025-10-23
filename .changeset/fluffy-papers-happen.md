---
"@credo-ts/openid4vc": minor
---

refactor(openid4vc): the OpenID4VC module now requires a top-level `app` property instead of a `router` for the `OpenId4VcVerifierModule` and `OpenId4VcIssuerModule`.

Using the `app` directly simplifies the setup, as you don't have to register the routers at the correct paths anymore on your express app.

We do recommend that you register your custom routes AFTER the Credo OpenID4VC routes have been registered, to ensure your custom middleware does not clash with Credo's routes.

The reason for changing the router to an `app` is that we need to host files at the top-level `.well-known` path of the server, which is not easily doable with the custom router approach.

If no app is provided, and the issuer or verifier module is enabled, a new app instance will be created.
