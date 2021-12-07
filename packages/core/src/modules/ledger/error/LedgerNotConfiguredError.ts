import { LedgerError } from './LedgerError'

export class LedgerNotConfiguredError extends LedgerError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
