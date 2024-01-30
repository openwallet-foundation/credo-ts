import { AriesFrameworkError } from './CredoError'

export class RecordDuplicateError extends AriesFrameworkError {
  public constructor(message: string, { recordType, cause }: { recordType: string; cause?: Error }) {
    super(`${recordType}: ${message}`, { cause })
  }
}
