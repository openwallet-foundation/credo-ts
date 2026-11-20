---
'@credo-ts/didcomm': patch
---

A message that fails decrypting, validating or handling is logged as a warning instead of an error. Message contents are only logged at debug, also for a received message.
