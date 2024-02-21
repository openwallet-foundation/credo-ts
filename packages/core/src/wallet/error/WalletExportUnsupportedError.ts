import { WalletError } from './WalletError'

export class WalletExportUnsupportedError extends WalletError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
