import { AskarStoreError } from './AskarStoreError'

export class AskarStoreExportUnsupportedError extends AskarStoreError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
