---
"@credo-ts/didcomm": patch
---

Fix the 15 second timeout when resolving a shortened invitation URL. The abort signal was never passed to `fetch`, so a server that accepted the connection but never responded left `parseInvitation` pending indefinitely.
