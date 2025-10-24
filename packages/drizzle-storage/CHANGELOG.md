# @credo-ts/drizzle-storage

## 0.6.0

### Minor Changes

- 6cb8d27: feat: add support for new SQLite and PostgreSQL storage based on Drizzle.

  The Drizzle Storage Module is an additional storage implementation for Credo which natively integrates with PostgreSQL and SQLite. It can be combined with Aries Askar as the KMS.

  The Drizzle Storage Module does not introduce any breaking chnages to how the storage APIs works in Credo, and for new projects you only have to configure the Drizzle module to connect to your database.

- bc6f0c7: Add support for both CJS and ESM module syntax.

  - Use `tsdown` to bundle for both CJS and ESM (bridge period) -> tsdown is based on rust, so it should help with performance
  - Update to `vitest` since jest doesn't work well with ESM -> this should also help with performance
  - Simplify type checking -> just a single type check script instead of one for all packages. This should help with performance.

### Patch Changes

- 7fb0092: fix: throw RecordDuplicateError when record already exists in Drizzle storage
- Updated dependencies [55318b2]
- Updated dependencies [e936068]
- Updated dependencies [43148b4]
- Updated dependencies [8dc1156]
- Updated dependencies [a888c97]
- Updated dependencies [2d10ec3]
- Updated dependencies [6d83136]
- Updated dependencies [312a7b2]
- Updated dependencies [1495177]
- Updated dependencies [1810764]
- Updated dependencies [66d3384]
- Updated dependencies [879ed2c]
- Updated dependencies [a64ada0]
- Updated dependencies [8a816d8]
- Updated dependencies [297d209]
- Updated dependencies [2312bb8]
- Updated dependencies [11827cc]
- Updated dependencies [81dbbec]
- Updated dependencies [9f78a6e]
- Updated dependencies [297d209]
- Updated dependencies [652ade8]
- Updated dependencies [568cc13]
- Updated dependencies [bea846b]
- Updated dependencies [13cd8cb]
- Updated dependencies [6f3f621]
- Updated dependencies [15acc49]
- Updated dependencies [df7580c]
- Updated dependencies [95e9f32]
- Updated dependencies [e936068]
- Updated dependencies [16f109f]
- Updated dependencies [7e6e8f0]
- Updated dependencies [e936068]
- Updated dependencies [617b523]
- Updated dependencies [90caf61]
- Updated dependencies [b5fc7a6]
- Updated dependencies [1f74337]
- Updated dependencies [589a16e]
- Updated dependencies [e936068]
- Updated dependencies [dca4fdf]
- Updated dependencies [17ec6b8]
- Updated dependencies [fccb5ab]
- Updated dependencies [9f78a6e]
- Updated dependencies [14673b1]
- Updated dependencies [607659a]
- Updated dependencies [9f78a6e]
- Updated dependencies [fee0260]
- Updated dependencies [44b1866]
- Updated dependencies [5f08bc6]
- Updated dependencies [27f971d]
- Updated dependencies [9f78a6e]
- Updated dependencies [cacd8ee]
- Updated dependencies [0d877f5]
- Updated dependencies [e936068]
- Updated dependencies [2d10ec3]
- Updated dependencies [1a4182e]
- Updated dependencies [a4f443b]
- Updated dependencies [90caf61]
- Updated dependencies [9f78a6e]
- Updated dependencies [9f78a6e]
- Updated dependencies [e936068]
- Updated dependencies [290ff19]
- Updated dependencies [8baa7d7]
- Updated dependencies [17ec6b8]
- Updated dependencies [decbcac]
- Updated dependencies [c57cece]
- Updated dependencies [9df09fa]
- Updated dependencies [9f78a6e]
- Updated dependencies [70c849d]
- Updated dependencies [8baa7d7]
- Updated dependencies [897c834]
- Updated dependencies [cfc2ac4]
- Updated dependencies [a53fc54]
- Updated dependencies [81e3571]
- Updated dependencies [9ef54ba]
- Updated dependencies [a4bdf6d]
- Updated dependencies [17ec6b8]
- Updated dependencies [8533cd6]
- Updated dependencies [e936068]
- Updated dependencies [edd2edc]
- Updated dependencies [e296877]
- Updated dependencies [9f78a6e]
- Updated dependencies [9f78a6e]
- Updated dependencies [9f78a6e]
- Updated dependencies [428fadd]
- Updated dependencies [1f74337]
- Updated dependencies [494c499]
- Updated dependencies [c5e2a21]
- Updated dependencies [d59e889]
- Updated dependencies [e936068]
- Updated dependencies [11545ce]
- Updated dependencies [e80794b]
- Updated dependencies [27f971d]
- Updated dependencies [9f78a6e]
- Updated dependencies [6b2a0fc]
- Updated dependencies [9f78a6e]
- Updated dependencies [8baa7d7]
- Updated dependencies [decbcac]
- Updated dependencies [9befbcb]
- Updated dependencies [6c8ab94]
- Updated dependencies [bc6f0c7]
- Updated dependencies [676af7f]
- Updated dependencies [d9e04db]
- Updated dependencies [d6086e9]
- Updated dependencies [ebdc7bb]
- Updated dependencies [1f74337]
- Updated dependencies [9f78a6e]
- Updated dependencies [885030a]
- Updated dependencies [0d49804]
- Updated dependencies [27f971d]
  - @credo-ts/core@0.6.0
  - @credo-ts/openid4vc@0.6.0
  - @credo-ts/didcomm@0.6.0
  - @credo-ts/question-answer@0.6.0
  - @credo-ts/action-menu@0.6.0
  - @credo-ts/anoncreds@0.6.0
  - @credo-ts/tenants@0.6.0
  - @credo-ts/drpc@0.6.0
