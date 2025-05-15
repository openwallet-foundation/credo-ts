import type { KeyManagementService } from './KeyManagementService'

import { KeyManagementError } from './error/KeyManagementError'

export interface KeyManagementModuleConfigOptions {
  /**
   * The backends to use for key management and cryptographic operations.
   */
  backends?: KeyManagementService[]

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
  #defaultBackend?: string
  #backends: KeyManagementService[]

  public constructor(options: KeyManagementModuleConfigOptions) {
    this.#backends = options.backends ?? []

    if (options.defaultBackend) {
      const defaultBackend = this.#backends.find((kms) => kms.backend === options.defaultBackend)
      if (!defaultBackend) {
        throw new KeyManagementError(
          `Default backend '${options.defaultBackend}' provided in KeyManagementModuleConfig, but not found in 'backends'. Make sure the backend identifier matches with a registered backend.`
        )
      }
      this.#defaultBackend = options.defaultBackend
    }
  }

  public get backends() {
    return this.#backends
  }

  public registerBackend(backend: KeyManagementService) {
    this.backends.push(backend)
  }

  public get defaultBackend() {
    const backend = this.backends.find((kms) => !this.#defaultBackend || this.#defaultBackend === kms.backend)
    if (!backend) {
      throw new KeyManagementError('Unable to determine default backend. ')
    }

    return backend
  }

  private toJSON() {
    return {
      defaultBackend: this.#defaultBackend,
      backends: this.backends.map((backend) => backend.backend),
    }
  }
}
