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
