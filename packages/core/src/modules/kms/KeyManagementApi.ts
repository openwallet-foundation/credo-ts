import { injectable } from 'tsyringe'

import { AgentContext } from '../../agent'
import { parseWithErrorHandling } from '../../utils/valibot'

import { KeyManagementModuleConfig } from './KeyManagementModuleConfig'
import { KeyManagementError } from './error/KeyManagementError'
import { KmsDecryptOptions, KmsDeleteKeyOptions, KmsGetPublicKeyOptions, KmsImportKeyOptions } from './options'
import { KmsCreateKeyOptions, KmsCreateKeyType, vKmsCreateKeyOptions } from './options/KmsCreateKeyOptions'
import { vKmsDecryptOptions } from './options/KmsDecryptOptions'
import { vKmsDeleteKeyOptions } from './options/KmsDeleteKeyOptions'
import { KmsEncryptOptions, vKmsEncryptOptions } from './options/KmsEncryptOptions'
import { vKmsGetPublicKeyOptions } from './options/KmsGetPublicKeyOptions'
import { vKmsImportKeyOptions } from './options/KmsImportKeyOptions'
import { KmsSignOptions, vKmsSignOptions } from './options/KmsSignOptions'
import { KmsVerifyOptions, vKmsVerifyOptions } from './options/KmsVerifyOptions'
import { vWithBackend, WithBackend } from './options/backend'

@injectable()
export class KeyManagementApi {
  public constructor(private keyManagementConfig: KeyManagementModuleConfig, private agentContext: AgentContext) {}

  /**
   * Create a key.
   */
  public async createKey<Type extends KmsCreateKeyType>(options: WithBackend<KmsCreateKeyOptions<Type>>) {
    const { backend, ...kmsOptions } = parseWithErrorHandling(
      vWithBackend(vKmsCreateKeyOptions),
      options,
      'Invalid options provided to createKey method'
    )

    const kms = this.getKms(backend)
    return await kms.createKey(this.agentContext, kmsOptions)
  }

  /**
   * Sign using a key.
   */
  public async sign(options: WithBackend<KmsSignOptions>) {
    const { backend, ...kmsOptions } = parseWithErrorHandling(
      vWithBackend(vKmsSignOptions),
      options,
      'Invalid options provided to sign method'
    )

    const kms = backend ? this.getKms(backend) : (await this.getKmsForKeyId(options.keyId)).kms
    return await kms.sign(this.agentContext, kmsOptions)
  }

  /**
   * Verify using a key.
   */
  public async verify(options: WithBackend<KmsVerifyOptions>) {
    const { backend, ...kmsOptions } = parseWithErrorHandling(
      vWithBackend(vKmsVerifyOptions),
      options,
      'Invalid options provided to verify method'
    )

    // TODO: we need to ask the backend whether it can perform a specfic operation.
    // because otherwise we will always take the first configured backend for crypto operations

    const kms =
      backend || typeof options.key !== 'string' ? this.getKms(backend) : (await this.getKmsForKeyId(options.key)).kms
    return await kms.verify(this.agentContext, kmsOptions)
  }

  /**
   * Encrypt.
   */
  public async encrypt(options: WithBackend<KmsEncryptOptions>) {
    const { backend, ...kmsOptions } = parseWithErrorHandling(
      vWithBackend(vKmsEncryptOptions),
      options,
      'Invalid options provided to encrypt method'
    )

    const kms =
      backend || typeof options.key !== 'string' ? this.getKms(backend) : (await this.getKmsForKeyId(options.key)).kms

    return await kms.encrypt(this.agentContext, kmsOptions)
  }

  /**
   * Decrypt.
   */
  public async decrypt(options: WithBackend<KmsDecryptOptions>) {
    const { backend, ...kmsOptions } = parseWithErrorHandling(
      vWithBackend(vKmsDecryptOptions),
      options,
      'Invalid options provided to decrypt method'
    )

    const kms =
      backend || typeof options.key !== 'string' ? this.getKms(backend) : (await this.getKmsForKeyId(options.key)).kms

    return await kms.decrypt(this.agentContext, kmsOptions)
  }

  /**
   * Import a key.
   */
  public async importKey(options: WithBackend<KmsImportKeyOptions>) {
    const { backend, ...kmsOptions } = parseWithErrorHandling(
      vWithBackend(vKmsImportKeyOptions),
      options,
      'Invalid options provided to importKey method'
    )

    const kms = this.getKms(backend)
    return await kms.importKey(this.agentContext, kmsOptions)
  }

  /**
   * Get a public key.
   */
  public async getPublicKey(options: WithBackend<KmsGetPublicKeyOptions>) {
    const { backend, keyId } = parseWithErrorHandling(
      vWithBackend(vKmsGetPublicKeyOptions),
      options,
      'Invalid options provided to getPublicKey method'
    )

    if (backend) {
      const kms = this.getKms(backend)
      return await kms.getPublicKey(this.agentContext, keyId)
    }

    const { publicKey } = await this.getKmsForKeyId(options.keyId)
    return publicKey
  }

  /**
   * Delete a key.
   */
  public async deleteKey(options: WithBackend<KmsDeleteKeyOptions>) {
    const { backend, ...kmsOptions } = parseWithErrorHandling(
      vWithBackend(vKmsDeleteKeyOptions),
      options,
      'Invalid options provided to deleteKey method'
    )

    const kms = this.getKms(backend)
    return await kms.deleteKey(this.agentContext, kmsOptions)
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
  private async getKmsForKeyId(keyId: string) {
    for (const kms of this.keyManagementConfig.backends) {
      const publicKey = await kms.getPublicKey(this.agentContext, keyId)
      if (publicKey)
        return {
          publicKey,
          kms,
        }
    }

    const availableBackends = this.keyManagementConfig.backends.map((kms) => `'${kms.backend}'`)
    throw new KeyManagementError(
      `No key management service has a key with keyId '${keyId}'. Available backends are ${availableBackends.join(
        ', '
      )}`
    )
  }

  private getKms(backend?: string) {
    if (!backend) {
      return this.keyManagementConfig.defaultBackend
    }

    const kms = this.keyManagementConfig.backends.find((kms) => kms.backend === backend)
    if (!kms) {
      const availableBackends = this.keyManagementConfig.backends.map((kms) => `'${kms.backend}'`)
      throw new KeyManagementError(
        `No key management service is configured for backend '${backend}'. Available backends are ${availableBackends.join(
          ', '
        )}`
      )
    }
    return kms
  }
}
