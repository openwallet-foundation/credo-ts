import { AskarStoreError } from './AskarStoreError'

/**
 * Thrown when another store was registered while a store was being opened or provisioned.
 */
export class AskarStoreAlreadyRegisteredError extends AskarStoreError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
