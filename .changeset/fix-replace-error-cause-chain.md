---
'@credo-ts/core': patch
---

Fix `replaceError` to include the full `error.cause` chain in log output. Previously, `cause` was always dropped because it is non-enumerable on both `CredoError` and the built-in `Error` class. The new implementation walks the cause chain inside the replacer, tracking visited errors in a local `Set` to replace circular references with `'[Circular]'` instead of throwing a `RangeError`.
