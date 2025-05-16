import { CredoDrizzleStorageError } from './CredoDrizzleStorageError'

export class CredoDrizzleColumnDoesNotExistError extends CredoDrizzleStorageError {
  public databaseType: 'sqlite' | 'postgres'
  public table: string
  public column: string

  public constructor({
    cause,
    databaseType,
    column,
    table,
  }: { cause?: Error; databaseType: 'postgres' | 'sqlite'; column: string; table: string }) {
    const message = `Column '${column}' does not exist in table '${table}' in ${databaseType} database`
    super(message, { cause })

    this.databaseType = databaseType
    this.column = column
    this.table = table
  }
}
