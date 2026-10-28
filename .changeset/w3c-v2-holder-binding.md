---
'@credo-ts/core': patch
---

Verifying a W3C VC 2.0 presentation now checks that every credential bound to a key with `cnf` is presented with that key, and that a KB-JWT on an SD-JWT credential is for that presentation. Before, a credential bound only through `cnf` could be presented by anyone. A KB-JWT is only accepted when a `domain` is given, and `cnf` can no longer be selectively disclosed. A `cnf` DID URL must now point to an `authentication` key, not an `assertionMethod` key. Signing a presentation for a holder with several authentication keys uses the key the credentials are bound to.
