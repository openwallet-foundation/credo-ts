import type { NodeKeyManagementStorage } from './NodeKeyManagementStorage'
import type { AgentContext } from '@credo-ts/core'

import { Kms, TypedArrayEncoder } from '@credo-ts/core'
import { randomUUID, createPrivateKey, createSecretKey } from 'node:crypto'

import {
  createEcKey,
  createRsaKey,
  createOkpKey,
  createOctKey,
  assertNodeSupportedEcCrv,
  assertNodeSupportedOkpCrv,
  assertNodeSupportedOctAlgorithm,
} from './crypto/createKey'
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
        publicJwk,
      }
    } catch (error) {
      if (error instanceof Kms.KeyManagementError) throw error

      throw new Kms.KeyManagementError('Error importing key', { cause: error })
    }
  }

  public async deleteKey(agentContext: AgentContext, options: Kms.KmsDeleteKeyOptions): Promise<boolean> {
    return await this.#storage.delete(agentContext, options.keyId)
  }

  public async createKey(
    agentContext: AgentContext,
    options: Kms.KmsCreateKeyOptions
  ): Promise<Kms.KmsCreateKeyReturn> {
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
        publicJwk: jwks.publicJwk,
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
      Kms.assertAllowedAlgForSigningKey(key, algorithm)
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
      } else if (options.key.kty === 'oct') {
        // If passing a key with `kty` the kid MUST be present
        if (!options.key.kid) {
          throw new Kms.KeyManagementError(
            `When providing a jwk key in the verify method with kty of 'oct', the 'kid' must be present.`
          )
        }

        key = await this.getKeyAsserted(agentContext, options.key.kid)
      } else {
        key = options.key
      }

      // 2. Validate alg and use for key
      Kms.assertAllowedAlgForSigningKey(key, algorithm)
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
