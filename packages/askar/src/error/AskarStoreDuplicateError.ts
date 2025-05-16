import { AskarStoreError } from './AskarStoreError'

export class AskarStoreDuplicateError extends AskarStoreError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
