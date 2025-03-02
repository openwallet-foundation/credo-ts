import type { WalletConfig } from '@credo-ts/core'

import { KeyDerivationMethod, WalletError } from '@credo-ts/core'
import { KdfMethod, StoreKeyMethod } from '@openwallet-foundation/askar-shared'

import {
  isAskarWalletPostgresStorageConfig,
  isAskarWalletSqliteStorageConfig,
} from '../wallet/AskarWalletStorageConfig'

export const keyDerivationMethodToStoreKeyMethod = (keyDerivationMethod: KeyDerivationMethod) => {
  const correspondenceTable = {
    [KeyDerivationMethod.Raw]: KdfMethod.Raw,
    [KeyDerivationMethod.Argon2IInt]: KdfMethod.Argon2IInt,
    [KeyDerivationMethod.Argon2IMod]: KdfMethod.Argon2IMod,
  }

  return new StoreKeyMethod(correspondenceTable[keyDerivationMethod])
}

/**
 * Creates a proper askar wallet URI value based on walletConfig
 * @param walletConfig WalletConfig object
 * @param credoDataPath framework data path (used in case walletConfig.storage.path is undefined)
 * @returns string containing the askar wallet URI
 */
export const uriFromWalletConfig = (
  walletConfig: WalletConfig,
  credoDataPath: string
): { uri: string; path?: string } => {
  let uri = ''
  let path: string | undefined

  // By default use sqlite as database backend
  if (!walletConfig.storage) {
    walletConfig.storage = { type: 'sqlite' }
  }

  const urlParams = []

  const storageConfig = walletConfig.storage
  if (isAskarWalletSqliteStorageConfig(storageConfig)) {
    if (storageConfig.config?.inMemory) {
      uri = 'sqlite://:memory:'
    } else {
      path = storageConfig.config?.path ?? `${credoDataPath}/wallet/${walletConfig.id}/sqlite.db`
      uri = `sqlite://${path}`
    }
  } else if (isAskarWalletPostgresStorageConfig(storageConfig)) {
    if (!storageConfig.config || !storageConfig.credentials) {
      throw new WalletError('Invalid storage configuration for postgres wallet')
    }

    if (storageConfig.config.connectTimeout !== undefined) {
      urlParams.push(`connect_timeout=${encodeURIComponent(storageConfig.config.connectTimeout)}`)
    }
    if (storageConfig.config.idleTimeout !== undefined) {
      urlParams.push(`idle_timeout=${encodeURIComponent(storageConfig.config.idleTimeout)}`)
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
  } else {
    throw new WalletError(`Storage type not supported: ${storageConfig.type}`)
  }

  // Common config options
  if (storageConfig.config?.maxConnections !== undefined) {
    urlParams.push(`max_connections=${encodeURIComponent(storageConfig.config.maxConnections)}`)
  }
  if (storageConfig.config?.minConnections !== undefined) {
    urlParams.push(`min_connections=${encodeURIComponent(storageConfig.config.minConnections)}`)
  }

  if (urlParams.length > 0) {
    uri = `${uri}?${urlParams.join('&')}`
  }

  return { uri, path }
}
