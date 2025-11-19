---
"@credo-ts/core": minor
---

chore: update the sd-jwt library. The `verification` object returned in the SdJwtVcService has been removed for now because the individual checks are not actually done separately and so was giving an incomplete result. For now you should use the error to determine which part of the verification failed.
