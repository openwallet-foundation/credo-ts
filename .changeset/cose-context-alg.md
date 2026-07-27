---
"@credo-ts/core": patch
---

Fail COSE Sign1 and Mac0 signing, and Mac0 verification, when no algorithm is declared instead of falling back to the first supported signature algorithm of the key. The Mac0 authenticate operation now also uses the algorithm provided by the caller. COSE Sign1 verification still falls back to the signature algorithm of the key, as @owf/mdoc does not forward the alg of the deviceAuth Sign1 structure yet.
