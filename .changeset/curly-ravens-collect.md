---
'@credo-ts/core': patch
'@credo-ts/cheqd': patch
---

Consolidate Ed25519 linked data proof suite contexts to use the bundled JSON-LD context registry and shared VC context URL constants. This removes duplicate suite-local Ed25519 context documents/constants, flattens the Ed25519 signature suite files into the main signature suites folder, and fixes bundled context document loading for URLs with fragments.
