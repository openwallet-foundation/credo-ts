import type { JwkProps, KeyEntryObject, Session } from '@hyperledger/aries-askar-shared'

import { Kms, utils, type AgentContext } from '@credo-ts/core'
import { ariesAskar, Jwk, Key, KeyAlgs, KeyEntryList, SigAlgs } from '@hyperledger/aries-askar-shared'
import { randomUUID } from 'node:crypto'

import { AskarStoreManager } from '../AskarStoreManager'
import { AskarErrorCode, isAskarError } from '../utils'

export class AksarKeyManagementService implements Kms.KeyManagementService {
  public readonly backend = 'askar'

  private static algToSigType: Partial<Record<Kms.KnownJwaSignatureAlgorithm, SigAlgs>> = {
    EdDSA: SigAlgs.EdDSA,
    ES256K: SigAlgs.ES256K,
    ES256: SigAlgs.ES256,
    ES384: SigAlgs.ES384,
  }

  private static crvToAlg: Partial<
    Record<Kms.KmsJwkPublicEc['crv'] | Kms.KmsJwkPublicOkp['crv'], KeyAlgs | undefined>
  > = {
    // EC
    secp256k1: KeyAlgs.EcSecp256k1,
    'P-256': KeyAlgs.EcSecp256r1,
    'P-384': KeyAlgs.EcSecp384r1,

    // TODO: we need to get the JWK key representation right first
    // BLS12381G1: KeyAlgs.Bls12381G1,
    // BLS12381G2: KeyAlgs.Bls12381G2,

    // P-521 not supported by askar
    'P-521': undefined,

    // OKP
    X25519: KeyAlgs.X25519,
    Ed25519: KeyAlgs.Ed25519,
  }

  private static symmetricAlgs = [
    KeyAlgs.AesA128Kw,
    KeyAlgs.AesA128CbcHs256,
    KeyAlgs.AesA128Gcm,
    KeyAlgs.AesA256Kw,
    KeyAlgs.AesA256CbcHs512,
    KeyAlgs.AesA256Gcm,
    KeyAlgs.Chacha20C20P,
    KeyAlgs.Chacha20XC20P,
  ]

  private withSession<Return>(agentContext: AgentContext, callback: (session: Session) => Return) {
    return agentContext.dependencyManager.resolve(AskarStoreManager).withSession(agentContext, callback)
  }

  public async getPublicKey(agentContext: AgentContext, keyId: string): Promise<Kms.KmsJwkPublic | null> {
    const key = await this.fetchAskarKey(agentContext, keyId)
    if (!key) return null

    // HACK: https://github.com/openwallet-foundation/askar/issues/329
    if (!key.key) {
      return {
        kid: keyId,
        kty: 'oct',
      } satisfies Kms.KmsJwkPublicOct
    }

    // TODO: we should add extra properties on the JWK stored in the metadata
    return this.publicJwkFromKey(key.key, { kid: keyId })
  }

  public async importKey(
    agentContext: AgentContext,
    options: Kms.KmsImportKeyOptions
  ): Promise<Kms.KmsImportKeyReturn> {
    const { kid } = options.privateJwk

    const privateJwk = {
      ...options.privateJwk,
      kid: kid ?? randomUUID(),
    }

    let key: Key | undefined = undefined
    try {
      if (privateJwk.kty === 'oct') {
        // TODO: we need to look at how to import symmetric keys, as we need the alg
        // Should we do the same as we do for createKey?
        throw new Kms.KeyManagementAlgorithmNotSupportedError(
          `importing keys with kty '${privateJwk.kty}'`,
          this.backend
        )
        // key = Key.fromSecretBytes({
        //   algorithm: KeyAlgs.AesA128Gcm,
        //   secretKey: TypedArrayEncoder.fromBase64(privateJwk.k),
        // })
      } else if (privateJwk.kty === 'EC' || privateJwk.kty === 'OKP') {
        // Throws error if not supported
        this.assertAskarAlgForJwkCrv(privateJwk.kty, privateJwk.crv)

        key = Key.fromJwk({ jwk: Jwk.fromJson(privateJwk) })
      }

      const _key = key
      if (!_key) {
        throw new Kms.KeyManagementAlgorithmNotSupportedError(`kty '${privateJwk.kty}'`, this.backend)
      }

      await this.withSession(agentContext, (session) => session.insertKey({ name: privateJwk.kid, key: _key }))
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

      // Handle case where key already exists
      if (isAskarError(error, AskarErrorCode.Duplicate)) {
        throw new Kms.KeyManagementKeyExistsError(privateJwk.kid, this.backend)
      }

      throw new Kms.KeyManagementError('Error importing key', { cause: error })
    } finally {
      key?.handle.free()
    }
  }

  public async deleteKey(agentContext: AgentContext, options: Kms.KmsDeleteKeyOptions): Promise<boolean> {
    try {
      await this.withSession(agentContext, (session) => session.removeKey({ name: options.keyId }))
      return true
    } catch (error) {
      // Handle case where key already exists
      if (isAskarError(error, AskarErrorCode.NotFound)) {
        return false
      }

      throw new Kms.KeyManagementError(`Error deleting key with id '${options.keyId}'`, { cause: error })
    }
  }

  public async createKey<Type extends Kms.KmsCreateKeyType>(
    agentContext: AgentContext,
    options: Kms.KmsCreateKeyOptions<Type>
  ): Promise<Kms.KmsCreateKeyReturn<Type>> {
    const { type, keyId } = options

    const kid = keyId ?? utils.uuid()
    let askarKey: Key | undefined = undefined
    try {
      if (type.kty === 'EC' || type.kty === 'OKP') {
        const keyAlg = this.assertAskarAlgForJwkCrv(type.kty, type.crv)
        askarKey = Key.generate(keyAlg)
      } else if (type.kty === 'oct') {
        // NOTE: askar is more specific in the intended use of the key at time of generation.
        // We either need to allow for this on a higher level (should be possible using `alg`)
        // but as the keys are the same it's ok to just always pick one and if used for another
        // purpose we can see them as the same.
        if (type.algorithm === 'aes') {
          const lengthToKeyAlg: Record<number, KeyAlgs | undefined> = {
            128: KeyAlgs.AesA128Gcm,
            256: KeyAlgs.AesA256Gcm,

            // Not supported by askar
            192: undefined,
          }

          const keyAlg = lengthToKeyAlg[type.length]
          if (!keyAlg) {
            throw new Kms.KeyManagementAlgorithmNotSupportedError(
              `length '${type.length}' for kty '${type.kty}' with algorithm '${type.algorithm}'. Supported length values are '128', '256'.`,
              this.backend
            )
          }

          askarKey = Key.generate(keyAlg)
        } else if (type.algorithm === 'c20p') {
          // Both X and non-X variant can be used with the same key
          askarKey = Key.generate(KeyAlgs.Chacha20C20P)
        } else {
          throw new Kms.KeyManagementAlgorithmNotSupportedError(
            `algorithm '${type.algorithm}' for kty '${type.kty}'`,
            this.backend
          )
        }
      }

      const _key = askarKey
      if (!_key) {
        throw new Kms.KeyManagementAlgorithmNotSupportedError(`kty '${type.kty}'`, this.backend)
      }

      const publicJwk = this.publicJwkFromKey(_key, { kid }) as Kms.KmsCreateKeyReturn<Type>['publicJwk']
      await this.withSession(agentContext, (session) => session.insertKey({ name: kid, key: _key }))

      return {
        publicJwk,
        keyId: kid,
      } as Kms.KmsCreateKeyReturn<Type>
    } catch (error) {
      if (error instanceof Kms.KeyManagementError) throw error

      // Handle case where key already exists
      if (isAskarError(error, AskarErrorCode.Duplicate)) {
        throw new Kms.KeyManagementKeyExistsError(kid, this.backend)
      }

      throw new Kms.KeyManagementError('Error creating key', { cause: error })
    } finally {
      askarKey?.handle.free()
    }
  }

  public async sign(agentContext: AgentContext, options: Kms.KmsSignOptions): Promise<Kms.KmsSignReturn> {
    const { keyId, algorithm, data } = options

    // 1. Retrieve the key
    const key = await this.getKeyAsserted(agentContext, keyId)
    try {
      const sigType = this.assertedSigTypeForAlg(algorithm)
      // Askar has a bug with loading symmetric keys, but we shouldn't get here as I don't think askar
      // support signing with symmetric keys, and we don't support it (it will be caught by assertedSigTypeForAlg)
      if (!key.key) {
        throw new Kms.KeyManagementAlgorithmNotSupportedError(`algorithm ${algorithm}`, this.backend)
      }

      // TODO: we should extend this with metadata properties (e.g. use, key_ops)
      const publicJwk = this.publicJwkFromKey(key.key, { kid: keyId })
      const privateJwk = this.privateJwkFromKey(key.key, { kid: keyId })

      // 2. Validate alg and use for key
      Kms.assertAllowedSigningAlgForKey(privateJwk, algorithm)
      Kms.assertKeyAllowsSign(publicJwk)

      // 3. Perform the signing operation
      const signature = key.key.signMessage({
        message: data,
        sigType,
      })

      return {
        signature,
      }
    } catch (error) {
      if (error instanceof Kms.KeyManagementError) throw error
      throw new Kms.KeyManagementError('Error signing with key', { cause: error })
    } finally {
      key.key?.handle.free()
    }
  }

  public async verify(agentContext: AgentContext, options: Kms.KmsVerifyOptions): Promise<Kms.KmsVerifyReturn> {
    const { algorithm, data, signature, key: keyInput } = options

    // Get askar sig type (and handles unsupported alg)
    const sigType = this.assertedSigTypeForAlg(algorithm)

    // Retrieve the key
    let askarKey:
      | KeyEntryObject
      | (Omit<KeyEntryObject, 'key'> & {
          key: undefined
        })
      | undefined
      | Key = undefined

    try {
      if (typeof keyInput === 'string') {
        askarKey = await this.getKeyAsserted(agentContext, keyInput)
      } else if (keyInput.kty === 'EC' || keyInput.kty === 'OKP') {
        // Throws error if not supported
        this.assertAskarAlgForJwkCrv(keyInput.kty, keyInput.crv)

        askarKey = Key.fromJwk({ jwk: Jwk.fromJson(keyInput as JwkProps) })
      } else {
        throw new Kms.KeyManagementAlgorithmNotSupportedError(`kty ${keyInput.kty}`, this.backend)
      }

      const signingKey = askarKey instanceof Key ? askarKey : askarKey?.key
      // Askar has a bug with loading symmetric keys, but we shouldn't get here as I don't think askar
      // support signing with symmetric keys, and we don't support it (it will be caught by assertedSigTypeForAlg)
      if (!signingKey) {
        throw new Kms.KeyManagementAlgorithmNotSupportedError(`algorithm ${algorithm}`, this.backend)
      }

      const keyId = askarKey instanceof Key ? (typeof keyInput === 'string' ? keyInput : keyInput.kid) : askarKey?.name

      const publicJwk = this.publicJwkFromKey(signingKey, { kid: keyId })
      const privateJwk = this.privateJwkFromKey(signingKey, { kid: keyId })

      // 2. Validate alg and use for key
      Kms.assertAllowedSigningAlgForKey(privateJwk, algorithm)
      Kms.assertKeyAllowsVerify(publicJwk)

      // 4. Perform the verify operation
      const verified = signingKey.verifySignature({ message: data, signature, sigType })
      if (verified) {
        return {
          verified: true,
          publicJwk: typeof keyInput === 'string' ? this.publicJwkFromKey(signingKey, { kid: keyId }) : keyInput,
        }
      }

      return {
        verified: false,
      }
    } catch (error) {
      if (error instanceof Kms.KeyManagementError) throw error
      throw new Kms.KeyManagementError('Error verifying with key', { cause: error })
    } finally {
      if (askarKey instanceof Key) askarKey.handle.free()
      else if (askarKey) askarKey.key?.handle.free()
    }
  }

  private assertedSigTypeForAlg(algorithm: Kms.KnownJwaSignatureAlgorithm): SigAlgs {
    const sigType = AksarKeyManagementService.algToSigType[algorithm]
    if (!sigType) {
      throw new Kms.KeyManagementAlgorithmNotSupportedError(
        `signing and verification with algorithm '${algorithm}'`,
        this.backend
      )
    }

    return sigType
  }

  private assertAskarAlgForJwkCrv(kty: string, crv: Kms.KmsJwkPublicEc['crv'] | Kms.KmsJwkPublicOkp['crv']) {
    const keyAlg = AksarKeyManagementService.crvToAlg[crv]
    if (!keyAlg) {
      throw new Kms.KeyManagementAlgorithmNotSupportedError(`crv '${crv}' for kty '${kty}'`, this.backend)
    }

    return keyAlg
  }

  private publicJwkFromKey(key: Key, partialJwkPublic?: Partial<Kms.KmsJwkPublic>) {
    return Kms.publicJwkFromPrivateJwk(this.privateJwkFromKey(key, partialJwkPublic))
  }

  private privateJwkFromKey(key: Key, partialJwkPrivate?: Partial<Kms.KmsJwkPrivate>) {
    // TODO: once we support additional params we should add these here
    return {
      ...partialJwkPrivate,
      ...key.jwkSecret,
    } as Kms.KmsJwkPrivate
  }

  private async fetchAskarKey(
    agentContext: AgentContext,
    keyId: string
  ): Promise<KeyEntryObject | (Omit<KeyEntryObject, 'key'> & { key: undefined }) | null> {
    return await this.withSession(agentContext, async (session) => {
      if (!session.handle) throw Error('Cannot fetch a key with a closed session')

      // Fetch the key from the session
      const handle = await ariesAskar.sessionFetchKey({ forUpdate: false, name: keyId, sessionHandle: session.handle })
      if (!handle) return null

      // Get the key entry
      const keyEntryList = new KeyEntryList({ handle })
      const keyEntry = keyEntryList.getEntryByIndex(0)

      // There seems to be a bug in Askar that it can't load a symmetric key.
      // https://github.com/openwallet-foundation/askar/issues/329
      if (AksarKeyManagementService.symmetricAlgs.includes(keyEntry.algorithm as KeyAlgs)) {
        const keyEntryObject = {
          algorithm: keyEntry.algorithm,
          metadata: keyEntry.metadata,
          name: keyEntry.name,
          tags: keyEntry.tags,
          key: undefined,
        }

        keyEntryList.handle.free()

        return keyEntryObject
      }

      // For other keys we will get the json
      const keyEntryObject = keyEntry.toJson()
      keyEntryList.handle.free()

      return keyEntryObject
    })
  }

  private async getKeyAsserted(agentContext: AgentContext, keyId: string) {
    const storageKey = await this.fetchAskarKey(agentContext, keyId)
    if (!storageKey) {
      throw new Kms.KeyManagementKeyNotFoundError(keyId, this.backend)
    }

    return storageKey
  }
}
