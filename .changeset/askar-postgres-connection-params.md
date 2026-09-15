---
"@credo-ts/askar": patch
---

Add `connectionParameters` to the Askar postgres database config. The parameters are added to the postgres connection url and passed to the underlying driver, allowing e.g. ssl options (`sslmode`, `sslrootcert`, etc.) to be configured without setting environment variables. See https://docs.rs/sqlx/latest/sqlx/postgres/struct.PgConnectOptions.html#parameters for supported parameters.
