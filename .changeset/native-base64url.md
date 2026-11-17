---
'@credo-ts/core': patch
---

Base64url encoding and decoding use the native `Uint8Array` base64 methods when the runtime has them (Node.js 25+ and recent browsers). This makes it 10-25x faster for payloads of 1KB and larger.
