import { AnonCredsError } from './AnonCredsError'

export class AnonCredsStoreRecordError extends AnonCredsError {
  public constructor(message: string, { cause }: { cause?: Error } = {}) {
    super(message, { cause })
  }
}
