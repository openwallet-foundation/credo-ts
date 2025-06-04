---
"@credo-ts/askar": patch
"@credo-ts/didcomm": patch
---

fix: incorrect key alg for didcomm. With the introduction of the new KMS API, the XC20P algorithm was used instead of the C20P. This is not resolved and tests have been added to ensure interop with previous Credo versions. 
