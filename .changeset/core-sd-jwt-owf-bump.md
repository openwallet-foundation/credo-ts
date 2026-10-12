---
'@credo-ts/core': patch
---

Update `@sd-jwt/*` to `^0.22.0` and `@owf/*` to `^0.4.2` (`@owf/mdoc` to `^0.8.2`).

- The error of a failed SD-JWT VC verification now carries a `code` (e.g. `JWT_EXPIRED`, `JWT_NOT_YET_VALID`, `INVALID_JWT_SIGNATURE`, `STATUS_INVALID`) and, for time and status checks, `details`. A failed `iat`, `nbf` or `exp` check is reported as a `JwtTimeClaimException`, a subclass of `SDJWTException`, whose `details` include the allowed clock skew.
- The `typ` header of a status list JWT is now checked by `@sd-jwt/sd-jwt-vc`, so Credo's own check is removed. A status list JWT whose `typ` is not `statuslist+jwt` is still rejected, now with an `SLException` (`The typ header '<typ>' must be equal to 'statuslist+jwt'`) instead of an `SdJwtVcError`.
