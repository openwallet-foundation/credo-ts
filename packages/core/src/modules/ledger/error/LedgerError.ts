import { AriesFrameworkError } from '../../../error/AriesFrameworkError'

export class LedgerError extends AriesFrameworkError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
