import { KeyManagementError } from './KeyManagementError'

export class KeyManagementKeyNotFoundError extends KeyManagementError {
  public constructor(keyId: string, backend: string) {
    super(`Key with key id '${keyId}' not found in backend '${backend}'`)
  }
}
