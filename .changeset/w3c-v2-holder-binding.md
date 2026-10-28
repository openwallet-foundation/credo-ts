---
'@credo-ts/core': patch
---

Verifying a W3C VC 2.0 presentation now checks that every credential bound to a key with `cnf` is presented with that key, and that a KB-JWT on an SD-JWT credential is for that presentation. Before, a credential bound only through `cnf` could be presented by anyone.
