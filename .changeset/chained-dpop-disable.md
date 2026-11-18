---
"@credo-ts/openid4vc": patch
---

DPoP towards a chained authorization server is now configured with `dpop.policy`, which replaces `dpop.requireServerSupport`:

- `required`: use DPoP. Authorization fails if the server does not advertise support. Replaces `requireServerSupport: true`.
- `preferred` (default): use DPoP if the server advertises support.
- `disallowed`: don't use DPoP for new issuance sessions, also when the server advertises support. Sessions that already use DPoP keep using it.

```ts
authorizationServerConfigs: [
  {
    type: 'chained',
    issuer: 'https://idp.example.com',
    clientAuthentication,
    dpop: { policy: 'disallowed' },
  },
]
```
