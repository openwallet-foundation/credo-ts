import { AskarStoreError } from './AskarStoreError'

export class AskarStoreInvalidKeyError extends AskarStoreError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
