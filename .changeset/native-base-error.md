---
'@credo-ts/core': patch
---

`CredoError` and its subclasses are now native subclasses of `Error`, and the `make-error` dependency is removed. Engines and test runners now recognise a Credo error as an error (`Error.isError`, `util.types.isNativeError`), and Vitest compares the `message` in `toEqual` and `toThrow` on Node 24 and later. The observable behaviour is unchanged: `name` is the class name, `cause` is a non-enumerable read-only property, and `inspect()` returns the full cause chain.
