---
'@credo-ts/didcomm': patch
---

The data integrity credential format can issue a credential bound to both an anoncreds link secret and a DID. The issuer failed to add its signature next to the anoncreds proof. The holder now verifies that signature before storing the credential, and rejects a credential bound to both without it. A holder on this version therefore can't receive such credentials from an issuer that doesn't add the signature yet.
