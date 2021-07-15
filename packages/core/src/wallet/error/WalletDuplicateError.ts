import { AriesFrameworkError } from '../../error/AriesFrameworkError'

export class WalletDuplicateError extends AriesFrameworkError {
  public constructor(message: string, { walletType, cause }: { walletType: string; cause?: Error }) {
    super(`${walletType}: ${message}`, { cause })
  }
}
