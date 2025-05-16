import { CredoDrizzleStorageError } from './CredoDrizzleStorageError'

export class CredoDrizzleColumnDoesNotExistError extends CredoDrizzleStorageError {
  public databaseType: 'sqlite' | 'postgres'
  public recordType: string
  public column: string

  public constructor({
    cause,
    databaseType,
    column,
    recordType,
  }: { cause?: Error; databaseType: 'postgres' | 'sqlite'; column: string; recordType: string }) {
    const message = `Column '${column}' does not exist for record '${recordType}' in ${databaseType} database`
    super(message, { cause })

    this.databaseType = databaseType
    this.column = column
    this.recordType = recordType
  }
}
