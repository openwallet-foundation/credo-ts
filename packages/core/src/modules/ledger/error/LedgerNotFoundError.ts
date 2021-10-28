import { LedgerError } from './LedgerError'

export class LedgerNotFoundError extends LedgerError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
