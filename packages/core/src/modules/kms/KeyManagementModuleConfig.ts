import type { KeyManagementService } from './KeyManagementService'

import { KeyManagementError } from './error/KeyManagementError'

export interface KeyManagementModuleConfigOptions {
  /**
   * The backends to use for key management and cryptographic operations.
   */
  backends: [KeyManagementService, ...KeyManagementService[]]

  /**
   * The default backend to use, indicated by the `backend` property
   * on the `KeyManagementService` instance.
   *
   * If provided and it doesn't match an entry in the `backends` array
   * an error will be thrown.
   *
   * If not provided, the first backend from the `backends` array will be used.
   */
  defaultBackend?: string
}

export class KeyManagementModuleConfig {
  #defaultBackend: KeyManagementService
  #backends: KeyManagementService[]

  public constructor(options: KeyManagementModuleConfigOptions) {
    this.#backends = [...options.backends]

    if (this.#backends.length === 0) {
      throw new KeyManagementError(
        `Empty array provided in KeyManagementModuleConfig 'backends', make sure to provide at least one backend.`
      )
    }

    const defaultBackend = this.#backends.find(
      (kms) => !options.defaultBackend || kms.backend === options.defaultBackend
    )
    if (!defaultBackend) {
      throw new KeyManagementError(
        `Default backend '${options.defaultBackend}' provided in KeyManagementModuleConfig, but not found in 'backends'. Make sure the backend identifier matches with a registered backend.`
      )
    }
    this.#defaultBackend = defaultBackend
  }

  public get backends() {
    return this.#backends
  }

  public get defaultBackend() {
    return this.#defaultBackend
  }
}
