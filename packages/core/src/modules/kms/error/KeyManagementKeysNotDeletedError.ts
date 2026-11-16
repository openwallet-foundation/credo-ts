import type { KmsKeyReference } from '../options'
import { KeyManagementError } from './KeyManagementError'

export interface KeyManagementNotDeletedKey extends KmsKeyReference {
  cause: Error
}

export class KeyManagementKeysNotDeletedError extends KeyManagementError {
  public constructor(public readonly keys: KeyManagementNotDeletedKey[]) {
    const details = keys.map(
      ({ keyId, kmsBackend, cause }) =>
        `key id '${keyId}'${kmsBackend ? ` in backend '${kmsBackend}'` : ''}: ${cause.message}`
    )
    super(`Failed to delete keys. ${details.join('. ')}`, { cause: keys[0]?.cause })
  }
}
