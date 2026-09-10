import { KdfMethod, StoreKeyMethod } from '@openwallet-foundation/askar-shared'
import type { AskarModuleConfigStoreOptions } from '../AskarModuleConfig'

import { isAskarPostgresStorageConfig, isAskarSqliteStorageConfig } from '../AskarStorageConfig'
import { AskarError } from '../error'

/**
 * Connection parameters that are derived from the postgres config and credentials, and thus
 * can't be provided using `connectionParameters`. Duplicate query parameters are resolved by
 * taking the last value, and query parameters take precedence over the url components.
 */
const reservedPostgresConnectionParameters = [
  // askar parameters
  'connect_timeout',
  'idle_timeout',
  'max_connections',
  'min_connections',
  'admin_account',
  'admin_password',
  // sqlx parameters that override the url components
  'host',
  'port',
  'user',
  'password',
  'dbname',
]

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
  let path: string | undefined

  const urlParams = []

  const database = storeConfig.database ?? { type: 'sqlite' }
  if (isAskarSqliteStorageConfig(database)) {
    if (database.config?.inMemory) {
      uri = 'sqlite://:memory:'
    } else {
      path = database.config?.path ?? `${credoDataPath}/wallet/${storeConfig.id}/sqlite.db`
      uri = `sqlite://${path}`
    }
  } else if (isAskarPostgresStorageConfig(database)) {
    if (!database.config || !database.credentials) {
      throw new AskarError('Invalid storage configuration for postgres wallet')
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
    for (const [key, value] of Object.entries(database.config.connectionParameters ?? {})) {
      if (value === undefined) continue
      if (reservedPostgresConnectionParameters.includes(key)) {
        throw new AskarError(
          `Postgres connection parameter '${key}' is not allowed in 'connectionParameters' as it is managed by Credo. Use the dedicated postgres config or credentials option instead.`
        )
      }
      urlParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    }

    uri = `postgres://${encodeURIComponent(database.credentials.account)}:${encodeURIComponent(
      database.credentials.password
    )}@${database.config.host}/${encodeURIComponent(storeConfig.id)}`
  } else {
    throw new AskarError('Storage type not supported')
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

export function isSqliteInMemoryUri(uri: string) {
  return uri.startsWith('sqlite://:memory:')
}

export function isSqliteFileUri(uri: string) {
  return uri.startsWith('sqlite://') && !isSqliteInMemoryUri(uri)
}

export function isPostgresUri(uri: string) {
  return uri.startsWith('postgres://')
}
