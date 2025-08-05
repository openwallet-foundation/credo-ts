---
"@credo-ts/core": minor
---

the automatic backup functionality has been removed from Credo. With the generalization of the KMS API, and with moving away from assuming Askar is used for storage, providing a generic backup API is not feasible, especially for large deployments. From now on, you are expected to create a backup yourself before performing any updates. For askar you can export a store on the Askar api, or you can directly create a backup of your Postgres database.
