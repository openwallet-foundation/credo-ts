import { WalletError } from './WalletError'

export class WalletNotFoundError extends WalletError {
  public constructor(message: string, { walletType, cause }: { walletType: string; cause?: Error }) {
    super(`${walletType}: ${message}`, { cause })
  }
}
