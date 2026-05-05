# @credo-ts/webvh

## 0.7.1

### Patch Changes

- Updated dependencies [7dfafeb]
  - @credo-ts/core@0.7.1
  - @credo-ts/anoncreds@0.7.1

## 0.7.0

### Minor Changes

- cc65c27: - Removed buffer dependency and replaced with `@scure/base` for base-x encoding/decoding

  - Updated DIDComm attachments to use base64url, not base64
  - Updated tests to make sure urland base64 encoded items use base64url
  - Added `fromBase64Url` to `TypedArrayEncoder` and `JsonEncoder`

  Breaking changes:

  1. `TypedArrayEncoder.fromBase64` does not support base64url anymore, please use `TypedArrayEncoder.fromBase64Url` for that. Same for `JsonEncoder`
  2. `TypedArrayEncoder.fromString` has been replaced by `TypedArrayEncoder.fromUtf8String` to be consistent with `TypedArrayEncoder.toUtf8String`
  3. Every place where we accepted `Buffer` as input we now only support `Uint8Array` as input
  4. `TypedArrayEncoder.equals` is now constant-time, however I would still hesitate to use it for any private crypto operation 5. Removed `Uint8ArrayBuffer` type, not used anymore

### Patch Changes

- Updated dependencies [5056b97]
- Updated dependencies [b75f0bf]
- Updated dependencies [e0c829e]
- Updated dependencies [120cee8]
- Updated dependencies [c1ab9be]
- Updated dependencies [10a3ce5]
- Updated dependencies [cc65c27]
- Updated dependencies [1a652e3]
- Updated dependencies [b7aec4e]
  - @credo-ts/core@0.7.0
  - @credo-ts/anoncreds@0.7.0

## 0.6.3

### Patch Changes

- 63802e7: feat: allow adding extra metadata to AnonCreds objects
- 7830c2e: bump `didwebvh-ts` to `2.7.2`
- Updated dependencies [73d2d59]
  - @credo-ts/core@0.6.3
  - @credo-ts/anoncreds@0.6.3

## 0.6.2

### Patch Changes

- Updated dependencies [b9bd214]
- Updated dependencies [69acbc3]
- Updated dependencies [4a4473c]
- Updated dependencies [2c15356]
- Updated dependencies [4989dd9]
- Updated dependencies [0f7171a]
- Updated dependencies [e441cc1]
- Updated dependencies [1969c67]
- Updated dependencies [620bb38]
- Updated dependencies [2073110]
- Updated dependencies [620bb38]
  - @credo-ts/core@0.6.2
  - @credo-ts/anoncreds@0.6.2

## 0.6.1

### Patch Changes

- Updated dependencies [9f60e1b]
  - @credo-ts/core@0.6.1
  - @credo-ts/anoncreds@0.6.1

## 0.6.0

### Minor Changes

- bc6f0c7: Add support for ESM module syntax.

  - Use `tsdown` to bundle for ESM -> tsdown is based on rust, so it should help with performance
  - Update to `vitest` since jest doesn't work well with ESM -> this should also help with performance
  - Simplify type checking -> just a single type check script instead of one for all packages. This should help with performance.

  NOTE: Since React Native bundles your code, the update to ESM should not cause issues. In addition all latest minor releases of Node 20 and 22 now support requiring ESM modules. This means that even if you project is still a CommonJS project, it can now depend on ESM modules. For this reason Credo is now fully an ESM module.

  Initially we added support for both CJS and ESM in parallel. However this caused issues with some libraries requiring the CJS output, and other the ESM output. Since Credo is only meant to be installed a single time for the dependency injection to work correctly, this resulted in unexpected behavior.

- 31f3c8b: Add WebVH DID method implementation using didwebvh-ts package

### Patch Changes

- df48452: feat(webvh): support AnonCreds object registration (schema, credential definition, revocation definition, revocation status lists)
- Updated dependencies [55318b2]
- Updated dependencies [e936068]
- Updated dependencies [43148b4]
- Updated dependencies [2d10ec3]
- Updated dependencies [6d83136]
- Updated dependencies [312a7b2]
- Updated dependencies [1495177]
- Updated dependencies [2cace9c]
- Updated dependencies [879ed2c]
- Updated dependencies [297d209]
- Updated dependencies [2312bb8]
- Updated dependencies [11827cc]
- Updated dependencies [9f78a6e]
- Updated dependencies [297d209]
- Updated dependencies [0500765]
- Updated dependencies [2cace9c]
- Updated dependencies [bea846b]
- Updated dependencies [13cd8cb]
- Updated dependencies [2cace9c]
- Updated dependencies [15acc49]
- Updated dependencies [df7580c]
- Updated dependencies [e936068]
- Updated dependencies [16f109f]
- Updated dependencies [e936068]
- Updated dependencies [617b523]
- Updated dependencies [90caf61]
- Updated dependencies [b5fc7a6]
- Updated dependencies [e936068]
- Updated dependencies [dca4fdf]
- Updated dependencies [9f78a6e]
- Updated dependencies [14673b1]
- Updated dependencies [0c274fe]
- Updated dependencies [2cace9c]
- Updated dependencies [607659a]
- Updated dependencies [44b1866]
- Updated dependencies [5f08bc6]
- Updated dependencies [27f971d]
- Updated dependencies [cacd8ee]
- Updated dependencies [e936068]
- Updated dependencies [2d10ec3]
- Updated dependencies [0500765]
- Updated dependencies [1a4182e]
- Updated dependencies [8be3d67]
- Updated dependencies [90caf61]
- Updated dependencies [9f78a6e]
- Updated dependencies [e936068]
- Updated dependencies [290ff19]
- Updated dependencies [8baa7d7]
- Updated dependencies [decbcac]
- Updated dependencies [9df09fa]
- Updated dependencies [2cace9c]
- Updated dependencies [70c849d]
- Updated dependencies [0c274fe]
- Updated dependencies [897c834]
- Updated dependencies [5ff7bba]
- Updated dependencies [a53fc54]
- Updated dependencies [81e3571]
- Updated dependencies [9ef54ba]
- Updated dependencies [8533cd6]
- Updated dependencies [e936068]
- Updated dependencies [edd2edc]
- Updated dependencies [e296877]
- Updated dependencies [9f78a6e]
- Updated dependencies [1f74337]
- Updated dependencies [c5e2a21]
- Updated dependencies [d59e889]
- Updated dependencies [e936068]
- Updated dependencies [645363d]
- Updated dependencies [e80794b]
- Updated dependencies [9f78a6e]
- Updated dependencies [9f78a6e]
- Updated dependencies [8baa7d7]
- Updated dependencies [d06669c]
- Updated dependencies [decbcac]
- Updated dependencies [9befbcb]
- Updated dependencies [6c8ab94]
- Updated dependencies [bc6f0c7]
- Updated dependencies [8be3d67]
- Updated dependencies [bd28bba]
- Updated dependencies [0d49804]
- Updated dependencies [27f971d]
  - @credo-ts/core@0.6.0
  - @credo-ts/anoncreds@0.6.0
