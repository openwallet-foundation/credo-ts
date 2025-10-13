import { createPrivateKey, createSecretKey, randomBytes, randomUUID } from 'node:crypto'
import type { AgentContext } from '@credo-ts/core'
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
import { deriveDecryptionKey, deriveEncryptionKey, nodeSupportedKeyAgreementAlgorithms } from './crypto/deriveKey'
import { nodeSupportedEncryptionAlgorithms, performEncrypt } from './crypto/encrypt'
import { nodeSupportedJwaAlgorithm, performSign } from './crypto/sign'
import { performVerify } from './crypto/verify'
import type { NodeKeyManagementStorage } from './NodeKeyManagementStorage'

export class NodeKeyManagementService implements Kms.KeyManagementService {
  public readonly backend = 'node'

  #storage: NodeKeyManagementStorage

  public constructor(storage: NodeKeyManagementStorage) {
    this.#storage = storage
  }

  public isOperationSupported(_agentContext: AgentContext, operation: Kms.KmsOperation): boolean {
    if (operation.operation === 'deleteKey') return true
    if (operation.operation === 'randomBytes') return true

    if (operation.operation === 'createKey') {
      // TODO: probably clean to split the assert methods so we don't need try/catch here
      try {
        if (operation.type.kty === 'RSA') {
          return true
        }

        if (operation.type.kty === 'EC') {
          assertNodeSupportedEcCrv(operation.type)
          return true
        }

        if (operation.type.kty === 'OKP') {
          assertNodeSupportedOkpCrv(operation.type)
          return true
        }

        if (operation.type.kty === 'oct') {
          assertNodeSupportedOctAlgorithm(operation.type)
          return true
        }
      } catch {
        return false
      }

      return false
    }

    if (operation.operation === 'importKey') {
      try {
        if (operation.privateJwk.kty === 'RSA' || operation.privateJwk.kty === 'oct') {
          return true
        }

        if (operation.privateJwk.kty === 'EC') {
          assertNodeSupportedEcCrv({ kty: operation.privateJwk.kty, crv: operation.privateJwk.crv })
          return true
        }

        if (operation.privateJwk.kty === 'OKP') {
          assertNodeSupportedOkpCrv({ kty: operation.privateJwk.kty, crv: operation.privateJwk.crv })
          return true
        }
      } catch {
        return false
      }
    }

    if (operation.operation === 'sign' || operation.operation === 'verify') {
      return nodeSupportedJwaAlgorithm.includes(operation.algorithm)
    }

    if (operation.operation === 'encrypt') {
      const isSupportedEncryptionAlgorithm = nodeSupportedEncryptionAlgorithms.includes(
        operation.encryption.algorithm as (typeof nodeSupportedEncryptionAlgorithms)[number]
      )
      if (!isSupportedEncryptionAlgorithm) return false
      if (!operation.keyAgreement) return true

      return nodeSupportedKeyAgreementAlgorithms.includes(
        operation.keyAgreement.algorithm as (typeof nodeSupportedKeyAgreementAlgorithms)[number]
      )
    }

    if (operation.operation === 'decrypt') {
      const isSupportedEncryptionAlgorithm = nodeSupportedEncryptionAlgorithms.includes(
        operation.decryption.algorithm as (typeof nodeSupportedEncryptionAlgorithms)[number]
      )
      if (!isSupportedEncryptionAlgorithm) return false
      if (!operation.keyAgreement) return true

      return nodeSupportedKeyAgreementAlgorithms.includes(
        operation.keyAgreement.algorithm as (typeof nodeSupportedKeyAgreementAlgorithms)[number]
      )
    }

    return false
  }

  public randomBytes(_agentContext: AgentContext, options: Kms.KmsRandomBytesOptions): Kms.KmsRandomBytesReturn {
    return randomBytes(options.length)
  }

  public async getPublicKey(agentContext: AgentContext, keyId: string): Promise<Kms.KmsJwkPublic | null> {
    const privateJwk = await this.#storage.get(agentContext, keyId)
    if (!privateJwk) return null

    return Kms.publicJwkFromPrivateJwk(privateJwk)
  }

  public async importKey<Jwk extends Kms.KmsJwkPrivate>(
    agentContext: AgentContext,
    options: Kms.KmsImportKeyOptions<Jwk>
  ): Promise<Kms.KmsImportKeyReturn<Jwk>> {
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
      } as Kms.KmsImportKeyReturn<Jwk>
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
      if (options.key.keyId) {
        key = await this.getKeyAsserted(agentContext, options.key.keyId)
      } else if (options.key.publicJwk?.kty === 'EC') {
        assertNodeSupportedEcCrv(options.key.publicJwk)
        key = options.key.publicJwk
      } else if (options.key.publicJwk?.kty === 'OKP') {
        assertNodeSupportedOkpCrv(options.key.publicJwk)
        key = options.key.publicJwk
      } else if (options.key.publicJwk?.kty === 'RSA') {
        key = options.key.publicJwk
      } else {
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
    const { data, encryption, key } = options

    Kms.assertSupportedEncryptionAlgorithm(encryption, nodeSupportedEncryptionAlgorithms, this.backend)

    let encryptionKey: Kms.KmsJwkPrivate
    let encryptedKey: Kms.KmsEncryptedKey | undefined

    if (key.keyId) {
      encryptionKey = await this.getKeyAsserted(agentContext, key.keyId)
    } else if (key.privateJwk) {
      encryptionKey = key.privateJwk
    } else if (key.keyAgreement) {
      Kms.assertAllowedKeyDerivationAlgForKey(key.keyAgreement.externalPublicJwk, key.keyAgreement.algorithm)
      Kms.assertKeyAllowsDerive(key.keyAgreement.externalPublicJwk)
      Kms.assertSupportedKeyAgreementAlgorithm(key.keyAgreement, nodeSupportedKeyAgreementAlgorithms, this.backend)

      const privateJwk = await this.getKeyAsserted(agentContext, key.keyAgreement.keyId)
      Kms.assertJwkAsymmetric(privateJwk, key.keyAgreement.keyId)
      Kms.assertAllowedKeyDerivationAlgForKey(privateJwk, key.keyAgreement.algorithm)
      Kms.assertKeyAllowsDerive(privateJwk)
      Kms.assertAsymmetricJwkKeyTypeMatches(privateJwk, key.keyAgreement.externalPublicJwk)

      const { contentEncryptionKey, encryptedContentEncryptionKey } = await deriveEncryptionKey({
        keyAgreement: key.keyAgreement,
        encryption,
        privateJwk,
      })

      encryptionKey = contentEncryptionKey
      encryptedKey = encryptedContentEncryptionKey
    } else {
      throw new Kms.KeyManagementError('Unexpected key parameter for encrypt')
    }

    if (encryptionKey.kty !== 'oct') {
      throw new Kms.KeyManagementAlgorithmNotSupportedError(
        `kty '${encryptionKey.kty} for content encryption'`,
        this.backend
      )
    }

    try {
      // 2. Validate alg and use for key
      Kms.assertAllowedEncryptionAlgForKey(encryptionKey, encryption.algorithm)
      Kms.assertKeyAllowsEncrypt(encryptionKey)

      // 3. Perform the encryption operation
      const encrypted = await performEncrypt(encryptionKey, options.encryption, data)
      return {
        ...encrypted,
        encryptedKey,
      }
    } catch (error) {
      if (error instanceof Kms.KeyManagementError) throw error

      throw new Kms.KeyManagementError('Error encrypting', { cause: error })
    }
  }

  public async decrypt(agentContext: AgentContext, options: Kms.KmsDecryptOptions): Promise<Kms.KmsDecryptReturn> {
    const { decryption, encrypted, key } = options

    Kms.assertSupportedEncryptionAlgorithm(decryption, nodeSupportedEncryptionAlgorithms, this.backend)

    let decryptionKey: Kms.KmsJwkPrivate
    if (key.keyId) {
      decryptionKey = await this.getKeyAsserted(agentContext, key.keyId)
    } else if (key.privateJwk) {
      decryptionKey = key.privateJwk
    } else if (key.keyAgreement) {
      Kms.assertSupportedKeyAgreementAlgorithm(key.keyAgreement, nodeSupportedKeyAgreementAlgorithms, this.backend)
      Kms.assertAllowedKeyDerivationAlgForKey(key.keyAgreement.externalPublicJwk, key.keyAgreement.algorithm)
      Kms.assertKeyAllowsDerive(key.keyAgreement.externalPublicJwk)

      const privateJwk = await this.getKeyAsserted(agentContext, key.keyAgreement.keyId)
      Kms.assertJwkAsymmetric(privateJwk, key.keyAgreement.keyId)
      Kms.assertAllowedKeyDerivationAlgForKey(privateJwk, key.keyAgreement.algorithm)
      Kms.assertKeyAllowsDerive(privateJwk)
      Kms.assertAsymmetricJwkKeyTypeMatches(privateJwk, key.keyAgreement.externalPublicJwk)

      const { contentEncryptionKey } = await deriveDecryptionKey({
        keyAgreement: key.keyAgreement,
        decryption,
        privateJwk,
      })

      decryptionKey = contentEncryptionKey
    } else {
      throw new Kms.KeyManagementError('Unexpected key parameter for decrypt')
    }

    if (decryptionKey.kty !== 'oct') {
      throw new Kms.KeyManagementAlgorithmNotSupportedError(
        `kty '${decryptionKey.kty}' for content encryption`,
        this.backend
      )
    }

    try {
      // 2. Validate alg and use for key
      Kms.assertAllowedEncryptionAlgForKey(decryptionKey, decryption.algorithm)
      Kms.assertKeyAllowsEncrypt(decryptionKey)

      // 3. Perform the decryption operation
      return await performDecrypt(decryptionKey, decryption, encrypted)
    } catch (error) {
      if (error instanceof Kms.KeyManagementError) throw error

      throw new Kms.KeyManagementError('Error decrypting', { cause: error })
    }
  }

  private async getKeyAsserted(agentContext: AgentContext, keyId: string) {
    const storageKey = await this.#storage.get(agentContext, keyId)
    if (!storageKey) {
      throw new Kms.KeyManagementKeyNotFoundError(keyId, [this.backend])
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
