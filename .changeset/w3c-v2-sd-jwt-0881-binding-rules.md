---
'@credo-ts/didcomm': patch
---

The `vc+sd-jwt` credential format (Aries RFC 0881) now applies the binding rules of the `didcomm_signed_attachment` binding method. The issuer checks that the binding proof uses an offered `alg`, a `kid` with an offered DID method that is in the `authentication` relationship, and not both `kid` and `jwk`. A failed check sends an `issuance-abandoned` problem report when the request is received, also when the issuer does not auto-accept requests. The holder only signs a binding proof the offer accepts, and rejects an issued credential whose `cnf` is not the `kid` of its binding proof. The `holder` accept request option is only used for a request without a binding proof, and a different holder than the binding proof key is rejected.
