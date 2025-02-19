import type { AskarModuleConfigStoreOptions } from '../AskarModuleConfig'
import type { WalletConfig } from '@credo-ts/core'

import { KeyDerivationMethod, WalletError } from '@credo-ts/core'
import { KdfMethod, StoreKeyMethod } from '@openwallet-foundation/askar-shared'

import {
  isAskarWalletPostgresStorageConfig,
  isAskarWalletSqliteStorageConfig,
} from '../wallet/AskarWalletStorageConfig'

const correspondenceTable = {
  [KeyDerivationMethod.Raw]: KdfMethod.Raw,
  [KeyDerivationMethod.Argon2IInt]: KdfMethod.Argon2IInt,
  [KeyDerivationMethod.Argon2IMod]: KdfMethod.Argon2IMod,
}
export const keyDerivationMethodToStoreKeyMethod = (keyDerivationMethod: KeyDerivationMethod) => {
  return new StoreKeyMethod(correspondenceTable[keyDerivationMethod])
}

/**
 * Creates an askar wallet URI value based on store config
 * @param credoDataPath framework data path (used in case walletConfig.storage.path is undefined)
 * @returns string containing the askar wallet URI
 */
export const uriFromStoreConfig = (
  storeConfig: AskarModuleConfigStoreOptions,
  credoDataPath: string
): { uri: string; path?: string } => {
  let uri = ''
  let path

  const urlParams = []

  const database = storeConfig.database ?? { type: 'sqlite' }
  if (isAskarWalletSqliteStorageConfig(database)) {
    if (database.config?.inMemory) {
      uri = 'sqlite://:memory:'
    } else {
      path = database.config?.path ?? `${credoDataPath}/wallet/${storeConfig.id}/sqlite.db`
      uri = `sqlite://${path}`
    }
  } else if (isAskarWalletPostgresStorageConfig(database)) {
    if (!database.config || !database.credentials) {
      throw new WalletError('Invalid storage configuration for postgres wallet')
    }

    if (database.config.connectTimeout !== undefined) {
      urlParams.push(`connect_timeout=${encodeURIComponent(database.config.connectTimeout)}`)
    }
    if (database.config.idleTimeout !== undefined) {
      urlParams.push(`idle_timeout=${encodeURIComponent(database.config.idleTimeout)}`)
    }
    if (database.credentials.adminAccount !== undefined) {
      urlParams.push(`admin_account=${encodeURIComponent(database.credentials.adminAccount)}`)
    }
    if (database.credentials.adminPassword !== undefined) {
      urlParams.push(`admin_password=${encodeURIComponent(database.credentials.adminPassword)}`)
    }

    uri = `postgres://${encodeURIComponent(database.credentials.account)}:${encodeURIComponent(
      database.credentials.password
    )}@${database.config.host}/${encodeURIComponent(storeConfig.id)}`
  } else {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    throw new WalletError(`Storage type not supported: ${database.type}`)
  }

  // Common config options
  if (database.config?.maxConnections !== undefined) {
    urlParams.push(`max_connections=${encodeURIComponent(database.config.maxConnections)}`)
  }
  if (database.config?.minConnections !== undefined) {
    urlParams.push(`min_connections=${encodeURIComponent(database.config.minConnections)}`)
  }

  if (urlParams.length > 0) {
    uri = `${uri}?${urlParams.join('&')}`
  }

  return { uri, path }
}

export function keyDerivationMethodFromStoreConfig(
  keyDerivationMethod?: AskarModuleConfigStoreOptions['keyDerivationMethod']
) {
  return new StoreKeyMethod(
    (keyDerivationMethod ?? KdfMethod.Argon2IMod) satisfies `${KdfMethod}` | KdfMethod as KdfMethod
  )
}

/**
 * Creates an askar wallet URI value based on walletConfig
 * @param walletConfig WalletConfig object
 * @param credoDataPath framework data path (used in case walletConfig.storage.path is undefined)
 * @returns string containing the askar wallet URI
 */
export const uriFromWalletConfig = (
  walletConfig: WalletConfig,
  credoDataPath: string
): { uri: string; path?: string } => {
  return uriFromStoreConfig(
    {
      id: walletConfig.id,
      key: walletConfig.key,
      keyDerivationMethod: correspondenceTable[
        walletConfig.keyDerivationMethod ?? KeyDerivationMethod.Argon2IMod
      ] as AskarModuleConfigStoreOptions['keyDerivationMethod'],
      database: walletConfig.storage as AskarModuleConfigStoreOptions['database'],
    },
    credoDataPath
  )
}

export function isSqliteInMemoryUri(uri: string) {
  return uri.startsWith('sqlite://:memory:')
}

export function isSqliteFileUri(uri: string) {
  return uri.startsWith('sqlite://') && !isSqliteInMemoryUri(uri)
}

export function isPostgresUri(uri: string) {
  return uri.startsWith('postgres://')
}
