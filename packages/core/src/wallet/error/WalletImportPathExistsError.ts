import { WalletError } from './WalletError'

export class WalletImportPathExistsError extends WalletError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
