import { KeyManagementError } from './KeyManagementError'

export class KeyManagementAlgorithmNotSupportedError extends KeyManagementError {
  public constructor(
    notSupported: string,
    public backend: string
  ) {
    super(`${backend} backend does not support ${notSupported}.`)
  }
}
