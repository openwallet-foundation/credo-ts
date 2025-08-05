---
"@credo-ts/core": minor
---

changed the console logger to call `toString()` on an error, due to the error serialization not working great in all environments
