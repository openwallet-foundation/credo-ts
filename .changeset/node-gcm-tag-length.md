---
'@credo-ts/node': patch
---

AES-GCM decryption in the Node key management service now requires a 16-byte authentication tag. Before, it also accepted truncated tags of 4 to 15 bytes.
