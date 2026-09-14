---
"@credo-ts/core": patch
---

fix(kms): respect the configured `defaultBackend` when no explicit `backend` is provided for a key management operation. Previously the first registered backend that supported the operation was always used and the `defaultBackend` option was silently ignored, which could result in keys being created in a different (e.g. software instead of hardware-backed) backend than configured. If the default backend does not support the requested operation, the first other backend that supports the operation is used and a warning is logged.
