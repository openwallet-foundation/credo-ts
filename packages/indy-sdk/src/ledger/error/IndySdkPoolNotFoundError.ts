import { IndySdkPoolError } from './IndySdkPoolError'

export class IndySdkPoolNotFoundError extends IndySdkPoolError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
