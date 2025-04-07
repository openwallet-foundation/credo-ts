import type { AgentContext } from '@credo-ts/core'

import { Buffer, Kms, P256Jwk, utils } from '@credo-ts/core'

import { importSecureEnvironment } from './secureEnvironment'

export class SecureEnvironmentKeyManagementService implements Kms.KeyManagementService {
  public readonly backend = 'secureEnvironment'
  private readonly secureEnvironment = importSecureEnvironment()

  public async getPublicKey(_agentContext: AgentContext, keyId: string): Promise<Kms.KmsJwkPublic | null> {
    try {
      return await this.getKeyAsserted(keyId)
    } catch (error) {
      if (error instanceof Kms.KeyManagementKeyNotFoundError) return null
      throw error
    }
  }

  public async importKey(): Promise<Kms.KmsImportKeyReturn> {
    // TODO: can we support this?
    throw new Kms.KeyManagementError(`Importing a key is not supported for backend '${this.backend}'`)
  }

  public async deleteKey(): Promise<boolean> {
    // TODO: can we support this?
    // @see https://github.com/animo/expo-secure-environment/issues/22
    throw new Kms.KeyManagementError(`Deleting a key is not supported for backend '${this.backend}'`)
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

    try {
      const keyId = options.keyId ?? utils.uuid()

      // TODO: Handle key already exists error
      await this.secureEnvironment.generateKeypair(keyId)

      return {
        keyId,
        publicJwk: await this.getKeyAsserted(keyId),
      }
    } catch (error) {
      if (error instanceof Kms.KeyManagementError) throw error
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

    // Ensure key exists. Because the library doesn't have a specific key not found
    // we get the key separately so we can throw a proper error message
    // @see https://github.com/animo/expo-secure-environment/issues/21
    await this.getKeyAsserted(options.keyId)

    try {
      // TODO: can we store something like 'use' for the key in secure environment?
      // Kms.assertKeyAllowsSign(publicJwk)

      // Perform the signing operation
      const signature = await this.secureEnvironment.sign(options.keyId, options.data)

      return {
        signature,
      }
    } catch (error) {
      if (error instanceof Kms.KeyManagementError) throw error
      throw new Kms.KeyManagementError('Error signing with key', { cause: error })
    }
  }

  public async verify(): Promise<Kms.KmsVerifyReturn> {
    // TODO: can we support this?
    // @see https://github.com/animo/expo-secure-environment/issues/25
    throw new Kms.KeyManagementError(`verification of signatures is not supported for backend '${this.backend}'`)
  }

  private publicJwkFromPublicKeyBytes(key: Uint8Array, keyId: string) {
    // TODO: we should move the decompression logic over at some point, for now we
    // depend on the P256Jwk class
    const p256Jwk = P256Jwk.fromPublicKey(Buffer.from(key))

    return {
      kid: keyId,
      kty: 'EC',
      crv: 'P-256',
      x: p256Jwk.x,
      y: p256Jwk.y,
    } satisfies Kms.KmsJwkPublicEc
  }

  private async getKeyAsserted(keyId: string) {
    try {
      const publicKeyBytes = await this.secureEnvironment.getPublicBytesForKeyId(keyId)
      return this.publicJwkFromPublicKeyBytes(publicKeyBytes, keyId)
    } catch (_error) {
      // The library doesn't have a specific key not found error so we just assume
      // if an error is thrown this is because the key couldn't be found.
      // @see https://github.com/animo/expo-secure-environment/issues/21
      throw new Kms.KeyManagementKeyNotFoundError(keyId, this.backend)
    }
  }
}
