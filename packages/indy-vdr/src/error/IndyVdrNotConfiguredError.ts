import {IndyVdrError} from './IndyVdrError'

export class IndyVdrConfiguredError extends IndyVdrError {
    public constructor(message: string, { cause }: { cause?: Error } = {}) {
      super(message, { cause })
    }
  }