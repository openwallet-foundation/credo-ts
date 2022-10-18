# Ledger

- [Configuration](#configuration)
  - [Pool Selector Algorithm](#pool-selector-algorithm)
  - [iOS Multiple Ledgers Troubleshooting](#ios-multiple-ledgers-troubleshooting)

## Configuration

Ledgers to be used by the agent can be specified in the agent configuration using the `indyLedgers` config. Only indy ledgers are supported at the moment. The `indyLedgers` property is an array of objects with the following properties. Either `genesisPath` or `genesisTransactions` must be set, but not both:

- `id`\*: The id (or name) of the ledger, also used as the pool name
- `isProduction`\*: Whether the ledger is a production ledger. This is used by the pool selector algorithm to know which ledger to use for certain interactions (i.e. prefer production ledgers over non-production ledgers)
- `genesisPath`: The path to the genesis file to use for connecting to an Indy ledger.
- `genesisTransactions`: String of genesis transactions to use for connecting to an Indy ledger.

```ts
const agentConfig: InitConfig = {
  indyLedgers: [
    {
      id: 'sovrin-main',
      didIndyNamespace: 'sovrin',
      isProduction: true,
      genesisPath: './genesis/sovrin-main.txn',
    },
    {
      id: 'bcovrin-test',
      didIndyNamespace: 'bcovrin:test',
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

### iOS Multiple Ledgers Troubleshooting

With having multiple ledgers, you can run into issues relating to credential issuance or other ledger operation in iOS release environments (as seen in [#647](https://github.com/hyperledger/aries-framework-javascript/issues/647)). This can appear as a soft crash preventing usage of the ledger. If you're able to get the logs, they might look similar to the following:

```
Undefined error: 0
thread '<unnamed>' panicked at 'FIXME: IndyError { inner: Too many open files

IO error }', src/libcore/result.rs:1165:5
```

This issue results as too many files/resources have been opened in the process of connecting to the ledgers. IOS defaults the limit to 256 (rlimit). This is likely something that can and should be addressed in indy-sdk or indy-vdr in the future.

#### Reduce Configured Ledgers

This issue is specifically tied to the number of ledgers configured, and can be addressed by reducing the number of ledgers configured.

#### Increase Open Files Limit

In your apps `main.m`, you can add the following to log and increase the rlimit (if it's less than the `NEW_SOFT_LIMIT`, in this case, 1024):

```main.m
  struct rlimit rlim;
  unsigned long long NEW_SOFT_LIMIT = 1024;

  //Fetch existing file limits, adjust file limits if possible
  if (getrlimit(RLIMIT_NOFILE, &rlim) == 0) {
    NSLog(@"Current soft RLimit: %llu", rlim.rlim_cur);
    NSLog(@"Current hard RLimit: %llu", rlim.rlim_max);

    // Adjust only if the limit is less than NEW_SOFT_LIMIT
    if(rlim.rlim_cur < NEW_SOFT_LIMIT){
      rlim.rlim_cur = NEW_SOFT_LIMIT;
    }

    if (setrlimit(RLIMIT_NOFILE, &rlim) == -1) {
      NSLog(@"Can't set RLimits");
    }
  } else {
    NSLog(@"Can't fetch RLimits");
  }

  // Re-fetch file limits
  if (getrlimit(RLIMIT_NOFILE, &rlim) == 0) {
    NSLog(@"New soft RLimit: %llu", rlim.rlim_cur);
    NSLog(@"New hard RLimit: %llu", rlim.rlim_max);
  } else {
    NSLog(@"Can't fetch RLimits");
  }
```

Once run, the logs will look like:

```
2022-05-24 15:46:32.256188-0600 AriesBifold[731:288330] Current soft RLimit: 256
2022-05-24 15:46:32.256343-0600 AriesBifold[731:288330] Current hard RLimit: 9223372036854775807
2022-05-24 15:46:32.256358-0600 AriesBifold[731:288330] New soft RLimit: 1024
2022-05-24 15:46:32.256369-0600 AriesBifold[731:288330] New hard RLimit: 9223372036854775807
```

Example main.m file with the above changes: https://github.com/hyperledger/aries-mobile-agent-react-native/commit/b420d1df5c4bf236969aafad1e46000111fe30d5

Helpful resources:

- https://pubs.opengroup.org/onlinepubs/009695399/functions/getrlimit.html
- https://stackoverflow.com/a/62074374
