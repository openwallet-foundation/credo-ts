import type { AskarWalletPostgresStorageConfig } from '../wallet/AskarWalletPostgresStorageConfig'
import type { WalletConfig } from '@aries-framework/core'

import { KeyDerivationMethod, WalletError } from '@aries-framework/core'
import { StoreKeyMethod } from '@hyperledger/aries-askar-shared'

export const keyDerivationMethodToStoreKeyMethod = (keyDerivationMethod?: KeyDerivationMethod) => {
  if (!keyDerivationMethod) {
    return undefined
  }

  const correspondenceTable = {
    [KeyDerivationMethod.Raw]: StoreKeyMethod.Raw,
    [KeyDerivationMethod.Argon2IInt]: `${StoreKeyMethod.Kdf}:argon2i:int`,
    [KeyDerivationMethod.Argon2IMod]: `${StoreKeyMethod.Kdf}:argon2i:mod`,
  }

  return correspondenceTable[keyDerivationMethod] as StoreKeyMethod
}

/**
 * Creates a proper askar wallet URI value based on walletConfig
 * @param walletConfig WalletConfig object
 * @param afjDataPath framework data path (used in case walletConfig.storage.path is undefined)
 * @returns string containing the askar wallet URI
 */
export const uriFromWalletConfig = (
  walletConfig: WalletConfig,
  afjDataPath: string
): { uri: string; path?: string } => {
  let uri = ''
  let path

  // By default use sqlite as database backend
  if (!walletConfig.storage) {
    walletConfig.storage = { type: 'sqlite' }
  }

  if (walletConfig.storage.type === 'sqlite') {
    if (walletConfig.storage.inMemory) {
      uri = 'sqlite://:memory:'
    } else {
      path = (walletConfig.storage.path as string) ?? `${afjDataPath}/wallet/${walletConfig.id}/sqlite.db`
      uri = `sqlite://${path}`
    }
  } else if (walletConfig.storage.type === 'postgres') {
    const storageConfig = walletConfig.storage as unknown as AskarWalletPostgresStorageConfig

    if (!storageConfig.config || !storageConfig.credentials) {
      throw new WalletError('Invalid storage configuration for postgres wallet')
    }

    const urlParams = []
    if (storageConfig.config.connectTimeout !== undefined) {
      urlParams.push(`connect_timeout=${encodeURIComponent(storageConfig.config.connectTimeout)}`)
    }
    if (storageConfig.config.idleTimeout !== undefined) {
      urlParams.push(`idle_timeout=${encodeURIComponent(storageConfig.config.idleTimeout)}`)
    }
    if (storageConfig.config.maxConnections !== undefined) {
      urlParams.push(`max_connections=${encodeURIComponent(storageConfig.config.maxConnections)}`)
    }
    if (storageConfig.config.minConnections !== undefined) {
      urlParams.push(`min_connections=${encodeURIComponent(storageConfig.config.minConnections)}`)
    }
    if (storageConfig.credentials.adminAccount !== undefined) {
      urlParams.push(`admin_account=${encodeURIComponent(storageConfig.credentials.adminAccount)}`)
    }
    if (storageConfig.credentials.adminPassword !== undefined) {
      urlParams.push(`admin_password=${encodeURIComponent(storageConfig.credentials.adminPassword)}`)
    }

    uri = `postgres://${encodeURIComponent(storageConfig.credentials.account)}:${encodeURIComponent(
      storageConfig.credentials.password
    )}@${storageConfig.config.host}/${encodeURIComponent(walletConfig.id)}`

    if (urlParams.length > 0) {
      uri = `${uri}?${urlParams.join('&')}`
    }
  } else {
    throw new WalletError(`Storage type not supported: ${walletConfig.storage.type}`)
  }

  return { uri, path }
}
