import { CredoError } from '../../error/CredoError'

export class WalletError extends CredoError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
