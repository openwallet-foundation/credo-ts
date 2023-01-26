import { IndyVdrError } from './IndyVdrError'

export class IndyVdrNotConfiguredError extends IndyVdrError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
