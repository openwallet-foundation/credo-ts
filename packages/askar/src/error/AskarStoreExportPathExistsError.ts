import { AskarStoreError } from './AskarStoreError'

export class AskarStoreExportPathExistsError extends AskarStoreError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
