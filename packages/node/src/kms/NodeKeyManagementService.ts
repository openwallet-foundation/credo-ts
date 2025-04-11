import type { AgentContext } from '@credo-ts/core'
import type { NodeKeyManagementStorage } from './NodeKeyManagementStorage'

import { createPrivateKey, createSecretKey, randomUUID } from 'node:crypto'
import { Kms, TypedArrayEncoder } from '@credo-ts/core'

import {
  assertNodeSupportedEcCrv,
  assertNodeSupportedOctAlgorithm,
  assertNodeSupportedOkpCrv,
  createEcKey,
  createOctKey,
  createOkpKey,
  createRsaKey,
} from './crypto/createKey'
import { performDecrypt } from './crypto/decrypt'
import { deriveKey } from './crypto/deriveKey'
import { performEncrypt } from './crypto/encrypt'
import { performSign } from './crypto/sign'
import { performVerify } from './crypto/verify'

export class NodeKeyManagementService implements Kms.KeyManagementService {
  public readonly backend = 'node'

  #storage: NodeKeyManagementStorage

  public constructor(storage: NodeKeyManagementStorage) {
    this.#storage = storage
  }

  public async getPublicKey(agentContext: AgentContext, keyId: string): Promise<Kms.KmsJwkPublic | null> {
    const privateJwk = await this.#storage.get(agentContext, keyId)
    if (!privateJwk) return null

    return Kms.publicJwkFromPrivateJwk(privateJwk)
  }

  public async importKey(
    agentContext: AgentContext,
    options: Kms.KmsImportKeyOptions
  ): Promise<Kms.KmsImportKeyReturn> {
    const { kid } = options.privateJwk

    if (kid) await this.assertKeyNotExists(agentContext, kid)

    const privateJwk = {
      ...options.privateJwk,
      kid: kid ?? randomUUID(),
    }

    try {
      if (privateJwk.kty === 'oct') {
        // Just check if we can create a secret key instance
        createSecretKey(TypedArrayEncoder.fromBase64(privateJwk.k)).export({ format: 'jwk' })
      } else if (privateJwk.kty === 'EC') {
        assertNodeSupportedEcCrv({ kty: privateJwk.kty, crv: privateJwk.crv })
        // This validates the JWK
        createPrivateKey({
          format: 'jwk',
          key: privateJwk,
        })
      } else if (privateJwk.kty === 'OKP') {
        assertNodeSupportedOkpCrv({ kty: privateJwk.kty, crv: privateJwk.crv })
        // This validates the JWK
        createPrivateKey({
          format: 'jwk',
          key: privateJwk,
        })
      } else if (privateJwk.kty === 'RSA') {
        // This validates the JWK
        createPrivateKey({
          format: 'jwk',
          key: privateJwk,
        })
      } else {
        // All kty values supported for now, but can change in the future
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        throw new Kms.KeyManagementAlgorithmNotSupportedError(`kty '${privateJwk.kty}'`, this.backend)
      }

      await this.#storage.set(agentContext, privateJwk.kid, privateJwk)
      const publicJwk = Kms.publicJwkFromPrivateJwk(privateJwk)

      return {
        keyId: privateJwk.kid,
        publicJwk: {
          ...publicJwk,
          kid: privateJwk.kid,
        },
      }
    } catch (error) {
      if (error instanceof Kms.KeyManagementError) throw error

      throw new Kms.KeyManagementError('Error importing key', { cause: error })
    }
  }

  public async deleteKey(agentContext: AgentContext, options: Kms.KmsDeleteKeyOptions): Promise<boolean> {
    return await this.#storage.delete(agentContext, options.keyId)
  }

  public async createKey<Type extends Kms.KmsCreateKeyType>(
    agentContext: AgentContext,
    options: Kms.KmsCreateKeyOptions<Type>
  ): Promise<Kms.KmsCreateKeyReturn<Type>> {
    const { type, keyId } = options

    if (keyId) await this.assertKeyNotExists(agentContext, keyId)

    try {
      let jwks: { publicJwk: Kms.KmsJwkPublic; privateJwk: Kms.KmsJwkPrivate }
      if (type.kty === 'EC') {
        assertNodeSupportedEcCrv(type)
        jwks = await createEcKey(type)
      } else if (type.kty === 'OKP') {
        assertNodeSupportedOkpCrv(type)
        jwks = await createOkpKey(type)
      } else if (type.kty === 'RSA') {
        jwks = await createRsaKey(type)
      } else if (type.kty === 'oct') {
        assertNodeSupportedOctAlgorithm(type)
        jwks = await createOctKey(type)
      } else {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        throw new Kms.KeyManagementAlgorithmNotSupportedError(`kty '${type.kty}'`, this.backend)
      }

      jwks.privateJwk.kid = keyId ?? randomUUID()
      jwks.publicJwk.kid = jwks.privateJwk.kid

      await this.#storage.set(agentContext, jwks.privateJwk.kid, jwks.privateJwk)

      return {
        publicJwk: jwks.publicJwk as Kms.KmsCreateKeyReturn<Type>['publicJwk'],
        keyId: jwks.publicJwk.kid,
      }
    } catch (error) {
      if (error instanceof Kms.KeyManagementError) throw error

      throw new Kms.KeyManagementError('Error creating key', { cause: error })
    }
  }

  public async sign(agentContext: AgentContext, options: Kms.KmsSignOptions): Promise<Kms.KmsSignReturn> {
    const { keyId, algorithm, data } = options

    // 1. Retrieve the key
    const key = await this.getKeyAsserted(agentContext, keyId)

    try {
      // 2. Validate alg and use for key
      Kms.assertAllowedSigningAlgForKey(key, algorithm)
      Kms.assertKeyAllowsSign(key)

      // 3. Perform the signing operation
      const signature = await performSign(key, algorithm, data)

      return {
        signature,
      }
    } catch (error) {
      if (error instanceof Kms.KeyManagementError) throw error

      throw new Kms.KeyManagementError('Error signing with key', { cause: error })
    }
  }

  public async verify(agentContext: AgentContext, options: Kms.KmsVerifyOptions): Promise<Kms.KmsVerifyReturn> {
    const { algorithm, data, signature } = options

    try {
      let key: Exclude<Kms.KmsJwkPublic, Kms.KmsJwkPublicOct> | Kms.KmsJwkPrivate
      if (typeof options.key === 'string') {
        key = await this.getKeyAsserted(agentContext, options.key)
      } else if (options.key.kty === 'EC') {
        assertNodeSupportedEcCrv(options.key)
        key = options.key
      } else if (options.key.kty === 'OKP') {
        assertNodeSupportedOkpCrv(options.key)
        key = options.key
      } else if (options.key.kty === 'RSA') {
        key = options.key
      } else {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        throw new Kms.KeyManagementAlgorithmNotSupportedError(`kty ${options.key.kty}`, this.backend)
      }

      // 2. Validate alg and use for key
      Kms.assertAllowedSigningAlgForKey(key, algorithm)
      Kms.assertKeyAllowsVerify(key)

      // 3. Perform the verify operation
      const verified = await performVerify(key, algorithm, data, signature)
      if (verified) {
        return {
          verified: true,
          publicJwk: Kms.publicJwkFromPrivateJwk(key),
        }
      }

      return {
        verified: false,
      }
    } catch (error) {
      if (error instanceof Kms.KeyManagementError) throw error

      throw new Kms.KeyManagementError('Error verifying with key', { cause: error })
    }
  }

  public async encrypt(agentContext: AgentContext, options: Kms.KmsEncryptOptions): Promise<Kms.KmsEncryptReturn> {
    const { data, encryption } = options

    const key = typeof options.key === 'string' ? await this.getKeyAsserted(agentContext, options.key) : options.key
    if (key.kty !== 'oct') {
      throw new Kms.KeyManagementAlgorithmNotSupportedError(`kty '${key.kty} for content encryption'`, this.backend)
    }
    try {
      // 2. Validate alg and use for key
      Kms.assertAllowedEncryptionAlgForKey(key, encryption.algorithm)
      Kms.assertKeyAllowsEncrypt(key)

      // 3. Perform the encryption operation
      return await performEncrypt(key, options.encryption, data)
    } catch (error) {
      if (error instanceof Kms.KeyManagementError) throw error

      throw new Kms.KeyManagementError('Error encrypting', { cause: error })
    }
  }

  public async decrypt(agentContext: AgentContext, options: Kms.KmsDecryptOptions): Promise<Kms.KmsDecryptReturn> {
    const { decryption, encrypted } = options

    const key = typeof options.key === 'string' ? await this.getKeyAsserted(agentContext, options.key) : options.key
    if (key.kty !== 'oct') {
      throw new Kms.KeyManagementAlgorithmNotSupportedError(`kty '${key.kty} for content encryption'`, this.backend)
    }

    try {
      // 2. Validate alg and use for key
      Kms.assertAllowedEncryptionAlgForKey(key, decryption.algorithm)
      Kms.assertKeyAllowsEncrypt(key)

      // 3. Perform the decryption operation
      return await performDecrypt(key, decryption, encrypted)
    } catch (error) {
      if (error instanceof Kms.KeyManagementError) throw error

      throw new Kms.KeyManagementError('Error decrypting', { cause: error })
    }
  }

  public async deriveKey(_agentContext: AgentContext, options: Kms.KmsDeriveKeyOptions) {
    // We don't retrieve key from KMS. This is needed for X20C derivation
    // But not for the algorithms we currently support in Node.JS

    try {
      Kms.assertAllowedKeyDerivationAlgForKey(options.publicJwk, options.algorithm)
      Kms.assertKeyAllowsDerive(options.publicJwk)

      const derivedKey = await deriveKey(options)

      return {
        derivedKey,
      }
    } catch (error) {
      if (error instanceof Kms.KeyManagementError) throw error

      throw new Kms.KeyManagementError('Error decrypting', { cause: error })
    }
  }

  private async getKeyAsserted(agentContext: AgentContext, keyId: string) {
    const storageKey = await this.#storage.get(agentContext, keyId)
    if (!storageKey) {
      throw new Kms.KeyManagementKeyNotFoundError(keyId, this.backend)
    }

    return storageKey
  }

  private async assertKeyNotExists(agentContext: AgentContext, keyId: string) {
    const storageKey = await this.#storage.get(agentContext, keyId)

    if (storageKey) {
      throw new Kms.KeyManagementKeyExistsError(keyId, this.backend)
    }
  }
}
