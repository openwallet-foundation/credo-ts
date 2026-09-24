---
'@credo-ts/askar': patch
---

The `askar` option of the `AskarModule` now also accepts the `NativeAskar` class (available since `@openwallet-foundation/askar-shared` 0.6.0) in addition to an `Askar` instance. When `NativeAskar` is passed the registered native binding is resolved on each access, so it no longer matters whether the platform package (`askar-nodejs` / `askar-react-native`) was imported before Credo. This fixes errors like `Cannot read properties of undefined (reading 'keyGetJwkSecret')` in ESM, bundler and test-runner setups that load modules in a different order. See #2597, #2607.

Passing the (deprecated) `askar` export keeps working, and askar-shared `^0.4.3 || ^0.5.0 || ^0.6.0` remains supported.

```ts
import { NativeAskar } from '@openwallet-foundation/askar-nodejs'

new AskarModule({
  askar: NativeAskar,
  store: { id: 'my-wallet', key: 'my-key' },
})
```
