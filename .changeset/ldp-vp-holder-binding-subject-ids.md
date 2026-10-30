---
"@credo-ts/core": patch
---

Verifying a JSON-LD (`ldp_vp`) presentation now reads the `credentialSubject` ids from the expanded credential when it checks that the holder controls the subject. Before, only the literal `id` property was read, so a credential whose subject id was rewritten to `@id` or another alias of `@id` was accepted as a bearer credential, presented by anyone.
