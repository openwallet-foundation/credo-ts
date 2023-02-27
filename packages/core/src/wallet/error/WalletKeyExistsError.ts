import { WalletError } from './WalletError'

export class WalletKeyExistsError extends WalletError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
