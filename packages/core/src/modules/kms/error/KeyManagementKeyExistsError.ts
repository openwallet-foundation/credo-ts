import { KeyManagementError } from './KeyManagementError'

export class KeyManagementKeyExistsError extends KeyManagementError {
  public constructor(keyId: string, backend: string) {
    super(`A key with key id '${keyId}' already exists in backend '${backend}'`)
  }
}
