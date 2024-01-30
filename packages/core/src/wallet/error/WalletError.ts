import { AriesFrameworkError } from '../../error/CredoError'

export class WalletError extends AriesFrameworkError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
