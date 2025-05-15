import type { AgentContext } from '@credo-ts/core'

import { Kms, utils } from '@credo-ts/core'

import { importSecureEnvironment } from './secureEnvironment'

export class SecureEnvironmentKeyManagementService implements Kms.KeyManagementService {
  public readonly backend = 'secureEnvironment'
  private readonly secureEnvironment = importSecureEnvironment()

  public isOperationSupported(_agentContext: AgentContext, operation: Kms.KmsOperation): boolean {
    if (operation.operation === 'createKey') {
      return operation.type.kty === 'EC' && operation.type.crv === 'P-256'
    }

    if (operation.operation === 'sign') {
      return operation.algorithm === 'ES256'
    }

    if (operation.operation === 'deleteKey') {
      return true
    }

    return false
  }

  public randomBytes(_agentContext: AgentContext, _options: Kms.KmsRandomBytesOptions): Kms.KmsRandomBytesReturn {
    throw new Kms.KeyManagementError(`Generating random bytes is not supported for backend '${this.backend}'`)
  }

  public async getPublicKey(_agentContext: AgentContext, keyId: string): Promise<Kms.KmsJwkPublic | null> {
    try {
      return await this.getKeyAsserted(keyId)
    } catch (error) {
      if (error instanceof Kms.KeyManagementKeyNotFoundError) return null
      throw error
    }
  }

  public async importKey(): Promise<Kms.KmsImportKeyReturn<Kms.KmsJwkPrivate>> {
    throw new Kms.KeyManagementError(`Importing a key is not supported for backend '${this.backend}'`)
  }

  public async deleteKey(_agentContext: AgentContext, options: Kms.KmsDeleteKeyOptions): Promise<boolean> {
    try {
      await this.secureEnvironment.deleteKey(options.keyId)
      return true
    } catch (error) {
      if (error instanceof this.secureEnvironment.KeyNotFoundError) {
        return false
      }

      throw new Kms.KeyManagementError(`Error deleting key with id '${options.keyId}' in backend '${this.backend}'`, {
        cause: error,
      })
    }
  }

  public async encrypt(): Promise<Kms.KmsEncryptReturn> {
    throw new Kms.KeyManagementError(`Encryption is not supported for backend '${this.backend}'`)
  }

  public async decrypt(): Promise<Kms.KmsDecryptReturn> {
    throw new Kms.KeyManagementError(`Decryption is not supported for backend '${this.backend}'`)
  }

  public async createKey(
    _agentContext: AgentContext,
    options: Kms.KmsCreateKeyOptions
  ): Promise<Kms.KmsCreateKeyReturn> {
    if (options.type.kty !== 'EC') {
      throw new Kms.KeyManagementAlgorithmNotSupportedError(
        `kty ${options.type.kty}. Only EC P-256 supported.`,
        this.backend
      )
    }
    if (options.type.crv !== 'P-256') {
      throw new Kms.KeyManagementAlgorithmNotSupportedError(
        `kty ${options.type.kty} with crv ${options.type.crv}. Only EC P-256 supported.`,
        this.backend
      )
    }

    const keyId = options.keyId ?? utils.uuid()

    try {
      await this.secureEnvironment.generateKeypair(keyId)

      return {
        keyId,
        publicJwk: await this.getKeyAsserted(keyId),
      }
    } catch (error) {
      if (error instanceof Kms.KeyManagementError) throw error
      if (error instanceof this.secureEnvironment.KeyAlreadyExistsError) {
        throw new Kms.KeyManagementKeyExistsError(keyId, this.backend)
      }

      throw new Kms.KeyManagementError('Error creating key', { cause: error })
    }
  }

  public async sign(_agentContext: AgentContext, options: Kms.KmsSignOptions): Promise<Kms.KmsSignReturn> {
    if (options.algorithm !== 'ES256') {
      throw new Kms.KeyManagementAlgorithmNotSupportedError(
        `algorithm '${options.algorithm}'. Only 'ES256' supported.`,
        this.backend
      )
    }

    try {
      // TODO: can we store something like 'use' for the key in secure environment?
      // Kms.assertKeyAllowsSign(publicJwk)

      // Perform the signing operation
      const signature = await this.secureEnvironment.sign(options.keyId, options.data)

      return {
        signature,
      }
    } catch (error) {
      if (error instanceof this.secureEnvironment.KeyNotFoundError) {
        throw new Kms.KeyManagementKeyNotFoundError(options.keyId, this.backend)
      }

      throw new Kms.KeyManagementError('Error signing with key', { cause: error })
    }
  }

  public async verify(): Promise<Kms.KmsVerifyReturn> {
    throw new Kms.KeyManagementError(`verification of signatures is not supported for backend '${this.backend}'`)
  }

  private publicJwkFromPublicKeyBytes(key: Uint8Array, keyId: string) {
    const publicJwk = Kms.PublicJwk.fromPublicKey<Kms.P256PublicJwk['publicKey']>({
      kty: 'EC',
      crv: 'P-256',
      publicKey: key,
    }).toJson()

    return {
      ...publicJwk,
      kid: keyId,
    } satisfies Kms.KmsJwkPublicEc
  }

  private async getKeyAsserted(keyId: string) {
    try {
      const publicKeyBytes = await this.secureEnvironment.getPublicBytesForKeyId(keyId)
      return this.publicJwkFromPublicKeyBytes(publicKeyBytes, keyId)
    } catch (error) {
      if (error instanceof this.secureEnvironment.KeyNotFoundError) {
        throw new Kms.KeyManagementKeyNotFoundError(keyId, this.backend)
      }

      throw new Kms.KeyManagementError(`Error retrieving key with id '${keyId}' from backend ${this.backend}`, {
        cause: error,
      })
    }
  }
}
