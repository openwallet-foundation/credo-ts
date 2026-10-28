---
'@credo-ts/anoncreds': patch
---

Fixed native memory leaks in the AnonCreds module. Creating a schema now frees the schema object. Issuing a revocable credential frees the revocation registry definition, its private part and the status list it loads. Creating a proof frees the revocation status list. Converting, processing and storing W3C credentials, and creating and verifying W3C presentations, now free the native credentials, proof details and revocation objects they create, also when a step fails. Verifying a W3C presentation no longer creates a revocation state for each credential, which it didn't use.
