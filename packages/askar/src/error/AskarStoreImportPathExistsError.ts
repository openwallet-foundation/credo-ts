import { AskarStoreError } from './AskarStoreError'

export class AskarStoreImportPathExistsError extends AskarStoreError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
