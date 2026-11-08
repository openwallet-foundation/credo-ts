---
'@credo-ts/react-native': patch
---

Fixed a crash on start: the build loaded the `crypto.subtle.digest` shim before `react-native-get-random-values` added `globalThis.crypto`.

The shim adds only `crypto.subtle.digest`. Libraries that see `crypto.subtle` and skip their own fallback, such as `@cosmjs/crypto` for PBKDF2, need a full WebCrypto implementation such as `react-native-quick-crypto`.
