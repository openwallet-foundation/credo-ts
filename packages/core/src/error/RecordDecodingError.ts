import { CredoError } from './CredoError'

export class RecordDecodingError extends CredoError {
  public readonly recordType: string
  public readonly recordId: string

  public constructor(
    message: string,
    { recordType, recordId, cause }: { recordType: string; recordId: string; cause?: Error }
  ) {
    super(`${recordType} with id '${recordId}': ${message}`, { cause })
    this.recordType = recordType
    this.recordId = recordId
  }
}
