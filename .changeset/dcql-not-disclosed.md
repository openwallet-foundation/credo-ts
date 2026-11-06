---
'@credo-ts/core': minor
---

Update `dcql` to `^4.0.0`. In the `output` of a DCQL query result, an array element that is not selected is now `DcqlNotDisclosed` instead of `null`, so a claim with a literal `null` value is kept and matched. Code that reads the output must check for `DcqlNotDisclosed`, which is exported from `@credo-ts/core`:

```ts
import { DcqlNotDisclosed } from '@credo-ts/core'

const disclosed = output.list.filter((element) => element !== DcqlNotDisclosed)
```

Also updates `@sd-jwt/*` to `^0.23.0`, `@owf/cose` and `@owf/token-status-list` to `^0.5.0` and `@owf/mdoc` to `^0.8.3`.
