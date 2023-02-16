import type { WalletStorageConfig } from '@aries-framework/core'

export interface AskarWalletPostgresConfig {
  host: string
  connectTimeout?: number
  idleTimeout?: number
  maxConnections?: number
  minConnections?: number
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
