---
'@credo-ts/anoncreds': patch
---

The `anoncreds` option of the `AnonCredsModule` now also accepts the `NativeAnoncreds` class exported by `@hyperledger/anoncreds-shared` (and the platform packages) in addition to an `Anoncreds` instance. When `NativeAnoncreds` is passed the registered native binding is resolved on each access, so it no longer matters whether the platform package (`anoncreds-nodejs` / `anoncreds-react-native`) was imported before Credo. The `AnonCredsRsHolderService` also no longer uses the deprecated global `anoncreds` export, and uses the instance configured on the module instead.

Passing the (deprecated) `anoncreds` export keeps working.

```ts
import { NativeAnoncreds } from '@hyperledger/anoncreds-nodejs'

new AnonCredsModule({
  anoncreds: NativeAnoncreds,
  registries: [/* ... */],
})
```
