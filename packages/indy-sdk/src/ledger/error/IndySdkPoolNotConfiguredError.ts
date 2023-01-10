import { IndySdkPoolError } from './IndySdkPoolError'

export class IndySdkPoolNotConfiguredError extends IndySdkPoolError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
