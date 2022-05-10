import { AriesFrameworkError } from '../../../error/AriesFrameworkError'

export class StorageUpdateError extends AriesFrameworkError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
