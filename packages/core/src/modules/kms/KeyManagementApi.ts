import { injectable } from 'tsyringe'

import { AgentContext } from '../../agent'
import { zParseWithErrorHandling } from '../../utils/zod'

import { KeyManagementModuleConfig } from './KeyManagementModuleConfig'
import { KeyManagementError } from './error/KeyManagementError'
import { KeyManagementKeyNotFoundError } from './error/KeyManagementKeyNotFoundError'
import { type KmsJwkPrivate, getJwkHumanDescription } from './jwk'
import { createKeyTypeForSigningAlgorithm } from './jwk/alg/signing'
import {
  type KmsDecryptOptions,
  type KmsDeleteKeyOptions,
  type KmsGetPublicKeyOptions,
  type KmsImportKeyOptions,
  type KmsOperation,
  type KmsRandomBytesOptions,
  getKmsOperationHumanDescription,
} from './options'
import {
  type KmsCreateKeyForSignatureAlgorithmOptions,
  type KmsCreateKeyOptions,
  type KmsCreateKeyReturn,
  type KmsCreateKeyType,
  type KmsCreateKeyTypeAssymetric,
  zKmsCreateKeyForSignatureAlgorithmOptions,
  zKmsCreateKeyOptions,
} from './options/KmsCreateKeyOptions'
import { zKmsDecryptOptions } from './options/KmsDecryptOptions'
import { zKmsDeleteKeyOptions } from './options/KmsDeleteKeyOptions'
import { type KmsEncryptOptions, zKmsEncryptOptions } from './options/KmsEncryptOptions'
import { zKmsGetPublicKeyOptions } from './options/KmsGetPublicKeyOptions'
import { type KmsImportKeyReturn, zKmsImportKeyOptions } from './options/KmsImportKeyOptions'
import { zKmsRandomBytesOptions } from './options/KmsRandomBytesOptions'
import { type KmsSignOptions, zKmsSignOptions } from './options/KmsSignOptions'
import { type KmsVerifyOptions, zKmsVerifyOptions } from './options/KmsVerifyOptions'
import { type WithBackend, zWithBackend } from './options/backend'

@injectable()
export class KeyManagementApi {
  public constructor(
    private keyManagementConfig: KeyManagementModuleConfig,
    private agentContext: AgentContext
  ) {}

  /**
   * Whether an operation is supported.
   *
   * @returns a list of backends that support the operation. In case
   * no backends are supported it returns an empty array
   */
  public supportedBackendsForOperation(operation: KmsOperation): string[] {
    const supportedBackends: string[] = []

    for (const kms of this.keyManagementConfig.backends) {
      const isOperationSupported = kms.isOperationSupported(this.agentContext, operation)
      if (isOperationSupported) {
        supportedBackends.push(kms.backend)
      }
    }

    return supportedBackends
  }

  /**
   * Create a key.
   */
  public async createKey<Type extends KmsCreateKeyType>(
    options: WithBackend<KmsCreateKeyOptions<Type>>
  ): Promise<KmsCreateKeyReturn<Type>> {
    const { backend, ...kmsOptions } = zParseWithErrorHandling(
      zWithBackend(zKmsCreateKeyOptions),
      options,
      'Invalid options provided to createKey method'
    )

    const kms = this.getKms(this.agentContext, backend, {
      operation: 'createKey',
      type: options.type,
    })

    const key = await kms.createKey(this.agentContext, kmsOptions)
    key.publicJwk.kid = key.keyId

    this.agentContext.config.logger.debug(
      `Created key ${getJwkHumanDescription(key.publicJwk)} with key id '${key.keyId}'`
    )

    return key
  }

  /**
   * Create a key.
   */
  public async createKeyForSignatureAlgorithm(
    options: WithBackend<KmsCreateKeyForSignatureAlgorithmOptions>
  ): Promise<KmsCreateKeyReturn<KmsCreateKeyTypeAssymetric>> {
    const { backend, algorithm, ...kmsOptions } = zParseWithErrorHandling(
      zWithBackend(zKmsCreateKeyForSignatureAlgorithmOptions),
      options,
      'Invalid options provided to createKeyForSignatureAlgorithm method'
    )

    const type = createKeyTypeForSigningAlgorithm(options.algorithm)
    const kms = this.getKms(this.agentContext, backend, {
      operation: 'createKey',
      type,
    })

    // Ensure the kid is set to the keyId
    const key = await kms.createKey(this.agentContext, {
      ...kmsOptions,
      type,
    })
    key.publicJwk.kid = key.keyId

    return key
  }

  /**
   * Sign using a key.
   */
  public async sign(options: WithBackend<KmsSignOptions>) {
    const { backend, ...kmsOptions } = zParseWithErrorHandling(
      zWithBackend(zKmsSignOptions),
      options,
      'Invalid options provided to sign method'
    )

    const operation = {
      operation: 'sign',
      algorithm: options.algorithm,
    } as const

    const kms = backend
      ? this.getKms(this.agentContext, backend, operation)
      : (await this.getKmsForOperationAndKeyId(this.agentContext, options.keyId, operation)).kms
    return await kms.sign(this.agentContext, kmsOptions)
  }

  /**
   * Verify using a key.
   */
  public async verify(options: WithBackend<KmsVerifyOptions>) {
    const { backend, ...kmsOptions } = zParseWithErrorHandling(
      zWithBackend(zKmsVerifyOptions),
      options,
      'Invalid options provided to verify method'
    )

    const operation = { operation: 'verify', algorithm: options.algorithm } as const
    const kms =
      backend || typeof options.key !== 'string'
        ? this.getKms(this.agentContext, backend, operation)
        : (await this.getKmsForOperationAndKeyId(this.agentContext, options.key, operation)).kms

    return await kms.verify(this.agentContext, kmsOptions)
  }

  /**
   * Encrypt.
   */
  public async encrypt(options: WithBackend<KmsEncryptOptions>) {
    const { backend, ...kmsOptions } = zParseWithErrorHandling(
      zWithBackend(zKmsEncryptOptions),
      options,
      'Invalid options provided to encrypt method'
    )

    const operation = {
      operation: 'encrypt',
      encryption: options.encryption,
      keyAgreement: options.key.keyAgreement,
    } as const
    const kms =
      backend || typeof options.key !== 'string'
        ? this.getKms(this.agentContext, backend, operation)
        : (await this.getKmsForOperationAndKeyId(this.agentContext, options.key, operation)).kms

    return await kms.encrypt(this.agentContext, kmsOptions)
  }

  /**
   * Decrypt.
   */
  public async decrypt(options: WithBackend<KmsDecryptOptions>) {
    const { backend, ...kmsOptions } = zParseWithErrorHandling(
      zWithBackend(zKmsDecryptOptions),
      options,
      'Invalid options provided to decrypt method'
    )

    const operation = {
      operation: 'decrypt',
      decryption: options.decryption,
      keyAgreement: options.key.keyAgreement,
    } as const
    const kms =
      backend || typeof options.key !== 'string'
        ? this.getKms(
            this.agentContext,

            backend,
            operation
          )
        : (await this.getKmsForOperationAndKeyId(this.agentContext, options.key, operation)).kms

    return await kms.decrypt(this.agentContext, kmsOptions)
  }

  /**
   * Import a key.
   */
  public async importKey<Jwk extends KmsJwkPrivate>(
    options: WithBackend<KmsImportKeyOptions<Jwk>>
  ): Promise<KmsImportKeyReturn<Jwk>> {
    const { backend, ...kmsOptions } = zParseWithErrorHandling(
      zWithBackend(zKmsImportKeyOptions),
      options,
      'Invalid options provided to importKey method'
    )

    const operation = {
      operation: 'importKey',
      privateJwk: options.privateJwk,
    } as const
    const kms = this.getKms(this.agentContext, backend, operation)

    const key = await kms.importKey(this.agentContext, kmsOptions)

    this.agentContext.config.logger.trace(
      `Imported key ${getJwkHumanDescription(key.publicJwk)} with key id '${key.keyId}'`
    )

    return key
  }

  /**
   * Get a public key.
   */
  public async getPublicKey(options: WithBackend<KmsGetPublicKeyOptions>) {
    const { backend, keyId } = zParseWithErrorHandling(
      zWithBackend(zKmsGetPublicKeyOptions),
      options,
      'Invalid options provided to getPublicKey method'
    )

    if (backend) {
      const kms = this.getKms(this.agentContext, backend)
      const publicKey = await kms.getPublicKey(this.agentContext, keyId)

      if (!publicKey) {
        throw new KeyManagementKeyNotFoundError(keyId, [backend])
      }
    }

    const { publicKey } = await this.getKmsForOperationAndKeyId(this.agentContext, options.keyId)
    return publicKey
  }

  /**
   * Delete a key.
   */
  public async deleteKey(options: WithBackend<KmsDeleteKeyOptions>) {
    const { backend, ...kmsOptions } = zParseWithErrorHandling(
      zWithBackend(zKmsDeleteKeyOptions),
      options,
      'Invalid options provided to deleteKey method'
    )

    const operation = {
      operation: 'deleteKey',
    } as const
    const kms = this.getKms(this.agentContext, backend, operation)
    return await kms.deleteKey(this.agentContext, kmsOptions)
  }

  /**
   * Generate random bytes
   */
  public randomBytes(options: WithBackend<KmsRandomBytesOptions>) {
    const { backend, ...kmsOptions } = zParseWithErrorHandling(
      zWithBackend(zKmsRandomBytesOptions),
      options,
      'Invalid options provided to randomBytes method'
    )

    const operation = {
      operation: 'randomBytes',
    } as const
    const kms = this.getKms(this.agentContext, backend, operation)
    return kms.randomBytes(this.agentContext, kmsOptions)
  }

  /**
   * Get the kms associated with a specific `keyId`.
   *
   * This uses a naive approach of fetching the key for each configured kms
   * until it finds the registered key.
   *
   * In the future this approach might be optimized based on:
   * - caching
   * - keeping a registry
   * - backend specific key prefixes
   */
  private async getKmsForOperationAndKeyId(agentContext: AgentContext, keyId: string, operation?: KmsOperation) {
    for (const kms of this.keyManagementConfig.backends) {
      const isOperationSupported = operation ? kms.isOperationSupported(agentContext, operation) : true
      if (!isOperationSupported) continue

      const publicKey = await kms.getPublicKey(this.agentContext, keyId)
      if (publicKey)
        return {
          publicKey,
          kms,
        }
    }

    if (operation) {
      throw new KeyManagementKeyNotFoundError(
        keyId,
        this.keyManagementConfig.backends.map((b) => b.backend),
        `The key may exist in one of the key management services in which case the key management service does not support the ${getKmsOperationHumanDescription(operation)}`
      )
    }

    throw new KeyManagementKeyNotFoundError(
      keyId,
      this.keyManagementConfig.backends.map((b) => b.backend)
    )
  }

  /**
   * Get the kms backend for a specific operation.
   *
   * If a backend is provided, it will be checked if the backend supports
   * the operation. Otherwise the first backend that supports the operation
   * will be used.
   */
  private getKms(agentContext: AgentContext, backend?: string, operation?: KmsOperation) {
    if (backend) {
      const kms = this.keyManagementConfig.backends.find((kms) => kms.backend === backend)
      if (!kms) {
        const availableBackends = this.keyManagementConfig.backends.map((kms) => `'${kms.backend}'`)
        throw new KeyManagementError(
          `No key management service is configured for backend '${backend}'. Available backends are ${availableBackends.join(
            ', '
          )}`
        )
      }

      const isOperationSupported = operation ? kms.isOperationSupported(agentContext, operation) : true
      if (!isOperationSupported && operation) {
        throw new KeyManagementError(
          `Key management service backend '${backend}' does not support ${getKmsOperationHumanDescription(operation)}`
        )
      }

      return kms
    }

    for (const kms of this.keyManagementConfig.backends) {
      const isOperationSupported = operation ? kms.isOperationSupported(agentContext, operation) : true
      if (isOperationSupported) return kms
    }

    if (operation) {
      throw new KeyManagementError(
        `No key management service backend found that supports ${getKmsOperationHumanDescription(operation)}`
      )
    }

    throw new KeyManagementError('No key management service backend found.')
  }
}
