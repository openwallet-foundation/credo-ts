# Logging

## Using the Default ConsoleLogger

To enable logging inside the framework a logger must be passed to the agent config. A simple `ConsoleLogger` can be imported from the framework.

```ts
import { ConsoleLogger, LogLevel } from '@aries-framework/core'

const agentConfig = {
  // ... other config properties ...
  logger: new ConsoleLogger(LogLevel.info),
}
```

## Creating your own Logger

For more advanced use cases the `Logger` interface can be implemented. See the example below.

```ts
import { Logger, LogLevel } from '@aries-framework/core'

class MyCustomLogger implements Logger {
  public logLevel: LogLevel

  public constructor(logLevel: LogLevel = LogLevel.off) {
    this.logLevel = logLevel
  }

  public test(message: string, data?: Record<string, any>): void {
    console.log(message, data)
  }

  public trace(message: string, data?: Record<string, any>): void {
    console.log(message, data)
  }

  public debug(message: string, data?: Record<string, any>): void {
    console.log(message, data)
  }

  public info(message: string, data?: Record<string, any>): void {
    console.log(message, data)
  }

  public warn(message: string, data?: Record<string, any>): void {
    console.log(message, data)
  }

  public error(message: string, data?: Record<string, any>): void {
    console.log(message, data)
  }

  public fatal(message: string, data?: Record<string, any>): void {
    console.log(message, data)
  }
}
```

See [`TestLogger`](../../src/__tests__/logger.ts) for a more advanced example using the `tslog` library.

## Indy Logs

To enable logging in the underlying Rust framework, either `setLogger` or `setDefaultLogger` must be called on the indy dependency, as seen [here](https://github.com/hyperledger/indy-sdk/tree/master/wrappers/nodejs#logger).

The easiest way to do this from AFJ is through the `indy` property of `agentDependencies`.

```ts
import { agentDependencies } from '@aries-framework/node'

agentDependencies.indy.setDefaultLogger('trace')

// OR

agentDependencies.indy.setLogger(
  (level, target, message, modulePath, file, line) => {
    console.log('libindy said:', level, target, message, modulePath, file, line)
  }
)
```

>WARNING: You can only set the logger once. Call indy_set_default_logger, indy_set_logger, not both. Once it's been set, libindy won't let you change it.

You can also set the environement variable `RUST_LOG` to log at specified log levels. 
See https://crates.io/crates/env_logger for more information.