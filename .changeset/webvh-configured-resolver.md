---
'@credo-ts/webvh': patch
---

The `WebVhModule` now adds a `WebVhDidResolver` to the `DidsModule` when you didn't configure one there. `WebVhApi.resolveResource` and the `WebVhAnonCredsRegistry` use that resolver, so its `maxResourceBytes` applies to resources. The `WebVhDidResolver` is no longer registered in the dependency manager. Get it from the `DidsModuleConfig` resolvers instead.
