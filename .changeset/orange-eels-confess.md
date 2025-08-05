---
"@credo-ts/core": minor
---

refactor: changed the jws service verify jws service to allow passing the signer beforehand. Also the jwkResolver has been replaced by the resolveJwsSigner method to allow for better control over which signer method is expected. A new allowedJwsSignerMethods parameter is added to allow limiting which signer methods can be extracted from a jws. It is recommended to always pass the jws signer beforehand if you expect a specific signer. If you expect a specific signer method, it is recommended to pass allowedJwsSignerMethods.
