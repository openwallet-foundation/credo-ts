import type { WalletStorageConfig } from 'indy-sdk'

export interface FileSystem {
  readonly basePath: string

  exists(path: string): Promise<boolean>
  write(path: string, data: string): Promise<void>
  read(path: string): Promise<string>
  downloadToFile(url: string, path: string): Promise<void>
  loadPostgresPlugin?(storageConfig: WalletStorageConfig, storageCreds: WalletStorageCreds): Promise<boolean>
}

export enum WalletScheme {
  DatabasePerWallet = 'DatabasePerWallet',
  MultiWalletSingleTable = 'MultiWalletSingleTable',
  MultiWalletSingleTableSharedPool = 'MultiWalletSingleTableSharedPool',
}

export interface StorageConfig {
  url: string
  wallet_scheme?: WalletScheme
  path?: string | undefined
}

export interface WalletStorageCreds {
  [key: string]: unknown
}

export interface StorageCreds {
  account: string
  password: string
  admin_account: string
  admin_password: string
}
