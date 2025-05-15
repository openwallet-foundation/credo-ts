import { AskarStoreError } from './AskarStoreError'

export class AskarStoreNotFoundError extends AskarStoreError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
