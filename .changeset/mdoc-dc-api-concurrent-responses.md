---
'@credo-ts/core': patch
---

Verifying an mdoc DC API response now re-checks the verification session under a record lock before it moves to `ResponseVerified`. Before, two concurrent responses for the same session could both verify. A response for a session that already received one throws the new `MdocVerificationSessionFinishedError` and leaves the session unchanged. This needs storage with record locking, such as Postgres.
