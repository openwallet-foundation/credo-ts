import type { WalletStorageConfig } from '@credo-ts/core'

export interface AskarWalletPostgresConfig {
  host: string
  connectTimeout?: number
  idleTimeout?: number
  maxConnections?: number
  minConnections?: number
}

export interface AskarWalletSqliteConfig {
  // TODO: add other sqlite config options
  maxConnections?: number
  minConnections?: number
  inMemory?: boolean
  path?: string
}

export interface AskarWalletPostgresCredentials {
  account: string
  password: string
  adminAccount?: string
  adminPassword?: string
}

export interface AskarWalletPostgresStorageConfig extends WalletStorageConfig {
  type: 'postgres'
  config: AskarWalletPostgresConfig
  credentials: AskarWalletPostgresCredentials
}

export interface AskarWalletSqliteStorageConfig extends WalletStorageConfig {
  type: 'sqlite'
  config?: AskarWalletSqliteConfig
}

export function isAskarWalletSqliteStorageConfig(
  config?: WalletStorageConfig
): config is AskarWalletSqliteStorageConfig {
  return config?.type === 'sqlite'
}

export function isAskarWalletPostgresStorageConfig(
  config?: WalletStorageConfig
): config is AskarWalletPostgresStorageConfig {
  return config?.type === 'postgres'
}
