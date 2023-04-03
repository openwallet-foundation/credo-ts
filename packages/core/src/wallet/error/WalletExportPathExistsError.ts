import { WalletError } from './WalletError'

export class WalletExportPathExistsError extends WalletError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
