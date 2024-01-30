import { CredoError } from '../../../error/CredoError'

export class StorageUpdateError extends CredoError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
