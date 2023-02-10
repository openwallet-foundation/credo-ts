import { IndyVdrError } from './IndyVdrError'

export class IndyVdrNotFoundError extends IndyVdrError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
