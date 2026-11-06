/**
 * Connection parameters that are passed to the underlying postgres driver (sqlx).
 *
 * @see https://docs.rs/sqlx/latest/sqlx/postgres/struct.PgConnectOptions.html#parameters
 */
export interface AskarPostgresConnectionParameters {
  sslmode?: 'disable' | 'allow' | 'prefer' | 'require' | 'verify-ca' | 'verify-full'
  sslrootcert?: string
  sslcert?: string
  sslkey?: string
  'statement-cache-capacity'?: number
  application_name?: string
  options?: string

  [key: string]: string | number | boolean | undefined
}

export interface AskarPostgresConfig {
  host: string
  connectTimeout?: number
  idleTimeout?: number
  maxConnections?: number
  minConnections?: number

  /**
   * Additional connection parameters that will be added as query parameters to the
   * postgres connection url. This allows configuring e.g. ssl for the connection
   * without having to set environment variables.
   *
   * Parameters that are derived from the other config and credentials options (`connect_timeout`,
   * `idle_timeout`, `max_connections`, `min_connections`, `admin_account`, `admin_password`, `host`,
   * `port`, `user`, `password` and `dbname`) are not allowed.
   *
   * @see https://docs.rs/sqlx/latest/sqlx/postgres/struct.PgConnectOptions.html#parameters
   */
  connectionParameters?: AskarPostgresConnectionParameters
}

export interface AskarSqliteConfig {
  // TODO: add other sqlite config options
  maxConnections?: number
  minConnections?: number

  // TODO: split this up into two separate types SqliteInMemory and Sqlite
  inMemory?: boolean
  path?: string
}

export interface AskarPostgresCredentials {
  account: string
  password: string
  adminAccount?: string
  adminPassword?: string
}

export interface AskarPostgresStorageConfig {
  type: 'postgres'
  config: AskarPostgresConfig
  credentials: AskarPostgresCredentials
}

export interface AskarSqliteStorageConfig {
  type: 'sqlite'
  config?: AskarSqliteConfig
}

export type AskarStorageConfig = AskarPostgresStorageConfig | AskarSqliteStorageConfig

export function isAskarSqliteStorageConfig(config?: AskarStorageConfig): config is AskarSqliteStorageConfig {
  return config?.type === 'sqlite'
}

export function isAskarPostgresStorageConfig(config?: AskarStorageConfig): config is AskarPostgresStorageConfig {
  return config?.type === 'postgres'
}
