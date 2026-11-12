---
'@credo-ts/didcomm': patch
---

Fix `newest_received_time` and `oldest_received_time` of the message pickup 2.0 `status` message being set to the current time when no value was given. They are now left out.
