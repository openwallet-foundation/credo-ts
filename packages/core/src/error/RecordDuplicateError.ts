import { CredoError } from './CredoError'

export class RecordDuplicateError extends CredoError {
  public constructor(message: string, { recordType, cause }: { recordType: string; cause?: Error }) {
    super(`${recordType}: ${message}`, { cause })
  }
}
