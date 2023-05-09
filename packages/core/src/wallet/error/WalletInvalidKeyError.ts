import { WalletError } from './WalletError'

export class WalletInvalidKeyError extends WalletError {
  public constructor(message: string, { walletType, cause }: { walletType: string; cause?: Error }) {
    super(`${walletType}: ${message}`, { cause })
  }
}
