import { AriesFrameworkError } from '../../error/AriesFrameworkError'

export class WalletInvalidKeyError extends AriesFrameworkError {
  public constructor(message: string, { walletType, cause }: { walletType: string; cause?: Error }) {
    super(`${walletType}: ${message}`, { cause })
  }
}
