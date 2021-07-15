import { AriesFrameworkError } from './AriesFrameworkError'

export class RecordDuplicateError extends AriesFrameworkError {
  public constructor(message: string, { recordType, cause }: { recordType: string; cause?: Error }) {
    super(`${recordType}: ${message}`, { cause })
  }
}
