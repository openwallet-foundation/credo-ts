export interface AskarPostgresConfig {
  host: string
  connectTimeout?: number
  idleTimeout?: number
  maxConnections?: number
  minConnections?: number
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
