---
'@credo-ts/react-native': patch
---

Fixed a crash on start: the build loaded the `crypto.subtle.digest` shim before `react-native-get-random-values` added `globalThis.crypto`.
