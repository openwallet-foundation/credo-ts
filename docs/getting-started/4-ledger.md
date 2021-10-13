# Ledger

- [Configuration](#configuration)
  - [Pool Selector Algorithm](#pool-selector-algorithm)

## Configuration

Ledgers to be used by the agent can be specified in the agent configuration using the `indyLedgers` config. Only indy ledgers are supported at the moment. The `indyLedgers` property is an array of objects with the following properties. Either `genesisPath` or `genesisTransactions` must be set, but not both:

- `id`\*: The id (or name) of the ledger, also used as the pool name
- `isProduction`\*: Whether the ledger is a production ledger. This is used by the pool selector algorithm to know which ledger to use for certain interactions (i.e. prefer production ledgers over non-production ledgers)
- `genesisPath`: The path to the genesis file to use for connecting to an Indy ledger.
- `genesisTransactions`: String of genesis transactions to use for connecting to an Indy ledger.

```ts
const config = {
  indyLedgers: [
    {
      id: 'sovrin-main',
      isProduction: true,
      genesisPath: './genesis/sovrin-main.txn',
    },
    {
      id: 'bcovrin-test',
      isProduction: false,
      genesisTransactions: 'XXXX',
    },
  ],
}
```

### Pool Selector Algorithm

The pool selector algorithm automatically determines which pool (network/ledger) to use for a certain operation. For **write operations**, the first pool is always used. For **read operations** the process is a bit more complicated and mostly based on [this](https://docs.google.com/document/d/109C_eMsuZnTnYe2OAd02jAts1vC4axwEKIq7_4dnNVA) google doc.

The order of the ledgers in the `indyLedgers` configuration object matters. The pool selection algorithm works as follows:

- When the DID is anchored on only one of the configured ledgers, use that ledger
- When the DID is anchored on multiple of the configured ledgers
  - Use the first ledger (order of `indyLedgers`) with a self certified DID
  - If none of the DIDs are self certified use the first production ledger (order of `indyLedgers` with `isProduction: true`)
  - If none of the DIDs are self certified or come from production ledgers, use the first non production ledger (order of `indyLedgers` with `isProduction: false`)
- When the DID is not anchored on any of the configured ledgers, a `LedgerNotFoundError` will be thrown.
