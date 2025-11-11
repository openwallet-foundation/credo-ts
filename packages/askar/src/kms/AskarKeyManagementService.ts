import { type AgentContext, type AnyUint8Array, JsonEncoder, Kms, TypedArrayEncoder, utils } from '@credo-ts/core'
import type { JwkProps, KeyEntryObject, Session } from '@openwallet-foundation/askar-shared'
import {
  askar,
  CryptoBox,
  Jwk,
  Key,
  KeyAlgorithm,
  KeyEntryList,
  SignatureAlgorithm,
} from '@openwallet-foundation/askar-shared'

import { AskarStoreManager } from '../AskarStoreManager'
import { AskarErrorCode, isAskarError, jwkCrvToAskarAlg, jwkEncToAskarAlg } from '../utils'
import { aeadDecrypt } from './crypto/decrypt'
import { askarSupportedKeyAgreementAlgorithms, deriveDecryptionKey, deriveEncryptionKey } from './crypto/deriveKey'
import { type AskarSupportedEncryptionOptions, aeadEncrypt } from './crypto/encrypt'
import { randomBytes } from './crypto/randomBytes'

const askarSupportedEncryptionAlgorithms = [
  ...(Object.keys(jwkEncToAskarAlg) as Array<keyof typeof jwkEncToAskarAlg>),
  'XSALSA20-POLY1305',
] satisfies Array<Kms.KnownJwaContentEncryptionAlgorithm | Kms.KnownJwaKeyEncryptionAlgorithm>

export class AskarKeyManagementService implements Kms.KeyManagementService {
  public static readonly backend = 'askar'
  public readonly backend = AskarKeyManagementService.backend

  private static algToSigType: Partial<Record<Kms.KnownJwaSignatureAlgorithm, SignatureAlgorithm>> = {
    EdDSA: SignatureAlgorithm.EdDSA,
    ES256K: SignatureAlgorithm.ES256K,
    ES256: SignatureAlgorithm.ES256,
    ES384: SignatureAlgorithm.ES384,
  }

  private withSession<Return>(agentContext: AgentContext, callback: (session: Session) => Return) {
    return agentContext.dependencyManager.resolve(AskarStoreManager).withSession(agentContext, callback)
  }

  public isOperationSupported(_agentContext: AgentContext, operation: Kms.KmsOperation): boolean {
    if (operation.operation === 'deleteKey') return true
    if (operation.operation === 'randomBytes') return true

    if (operation.operation === 'importKey') {
      if (operation.privateJwk.kty === 'EC' || operation.privateJwk.kty === 'OKP') {
        return jwkCrvToAskarAlg[operation.privateJwk.crv] !== undefined
      }

      // RSA/oct not supported
      return false
    }

    if (operation.operation === 'createKey') {
      if (operation.type.kty === 'EC' || operation.type.kty === 'OKP') {
        return jwkCrvToAskarAlg[operation.type.crv] !== undefined
      }

      if (operation.type.kty === 'oct') {
        if (operation.type.algorithm === 'C20P') return true

        // TODO: sync with the createKey code
        if (operation.type.algorithm === 'aes') {
          return [128, 256].includes(operation.type.length)
        }
      }

      return false
    }

    if (operation.operation === 'sign' || operation.operation === 'verify') {
      return AskarKeyManagementService.algToSigType[operation.algorithm] !== undefined
    }

    if (operation.operation === 'encrypt') {
      const isSupportedEncryptionAlgorithm = askarSupportedEncryptionAlgorithms.includes(
        operation.encryption.algorithm as (typeof askarSupportedEncryptionAlgorithms)[number]
      )
      if (!isSupportedEncryptionAlgorithm) return false
      if (!operation.keyAgreement) return true

      return askarSupportedKeyAgreementAlgorithms.includes(
        operation.keyAgreement.algorithm as (typeof askarSupportedKeyAgreementAlgorithms)[number]
      )
    }

    if (operation.operation === 'decrypt') {
      const isSupportedEncryptionAlgorithm = askarSupportedEncryptionAlgorithms.includes(
        operation.decryption.algorithm as (typeof askarSupportedEncryptionAlgorithms)[number]
      )
      if (!isSupportedEncryptionAlgorithm) return false
      if (!operation.keyAgreement) return true

      return askarSupportedKeyAgreementAlgorithms.includes(
        operation.keyAgreement.algorithm as (typeof askarSupportedKeyAgreementAlgorithms)[number]
      )
    }

    return false
  }

  public randomBytes(_agentContext: AgentContext, options: Kms.KmsRandomBytesOptions): Kms.KmsRandomBytesReturn {
    return randomBytes(options.length)
  }

  public async getPublicKey(agentContext: AgentContext, keyId: string): Promise<Kms.KmsJwkPublic | null> {
    const key = await this.fetchAskarKey(agentContext, keyId)
    if (!key) return null

    return this.publicJwkFromKey(key.key, { kid: keyId })
  }

  public async importKey<Jwk extends Kms.KmsJwkPrivate>(
    agentContext: AgentContext,
    options: Kms.KmsImportKeyOptions<Jwk>
  ): Promise<Kms.KmsImportKeyReturn<Jwk>> {
    const { kid } = options.privateJwk

    const privateJwk = {
      ...options.privateJwk,
      kid: kid ?? utils.uuid(),
    }

    let key: Key | undefined
    try {
      if (privateJwk.kty === 'oct') {
        // TODO: we need to look at how to import symmetric keys, as we need the alg
        // Should we do the same as we do for createKey?
        throw new Kms.KeyManagementAlgorithmNotSupportedError(
          `importing keys with kty '${privateJwk.kty}'`,
          this.backend
        )
      }
      if (privateJwk.kty === 'EC' || privateJwk.kty === 'OKP') {
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
      } as Kms.KmsImportKeyReturn<Jwk>
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
      // Handle case where key does not exist
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

    // FIXME: we should maybe keep the default keyId as publicKeyBase58 for a while for now, so it doesn't break
    // Or we need a way to query a key based on the public key?
    const kid = keyId ?? utils.uuid()
    let askarKey: Key | undefined
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
          const lengthToKeyAlg: Record<number, KeyAlgorithm | undefined> = {
            128: KeyAlgorithm.AesA128Gcm,
            256: KeyAlgorithm.AesA256Gcm,
            512: KeyAlgorithm.AesA256CbcHs512,
          }

          const keyAlg = lengthToKeyAlg[type.length]
          if (!keyAlg) {
            throw new Kms.KeyManagementAlgorithmNotSupportedError(
              `length '${type.length}' for kty '${type.kty}' with algorithm '${type.algorithm}'. Supported length values are ${Object.keys(lengthToKeyAlg).join(', ')}`,
              this.backend
            )
          }

          askarKey = Key.generate(keyAlg)
        } else if (type.algorithm === 'C20P') {
          // Both X and non-X variant can be used with the same key
          askarKey = Key.generate(KeyAlgorithm.Chacha20C20P)
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
        message: new Uint8Array(data),
        sigType,
      })

      return {
        signature: new Uint8Array(signature),
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
    let askarKey: Key | undefined

    try {
      if (keyInput.keyId) {
        askarKey = (await this.getKeyAsserted(agentContext, keyInput.keyId)).key
      } else if (keyInput.publicJwk?.kty === 'EC' || keyInput.publicJwk?.kty === 'OKP') {
        // Throws error if not supported
        this.assertAskarAlgForJwkCrv(keyInput.publicJwk.kty, keyInput.publicJwk.crv)

        askarKey = Key.fromJwk({ jwk: Jwk.fromJson(keyInput.publicJwk as JwkProps) })
      } else {
        throw new Kms.KeyManagementAlgorithmNotSupportedError(`kty ${keyInput.publicJwk?.kty}`, this.backend)
      }

      // Askar has a bug with loading symmetric keys, but we shouldn't get here as I don't think askar
      // support signing with symmetric keys, and we don't support it (it will be caught by assertedSigTypeForAlg)
      if (!askarKey) {
        throw new Kms.KeyManagementAlgorithmNotSupportedError(`algorithm ${algorithm}`, this.backend)
      }

      const keyId = keyInput.keyId ?? keyInput.publicJwk?.kid
      const publicJwk = this.publicJwkFromKey(askarKey, { kid: keyId })

      // For symmetric verificdation we need the private key
      if (publicJwk.kty === 'oct') {
        const privateJwk = this.privateJwkFromKey(askarKey, { kid: keyId })

        // 2. Validate alg and use for key
        Kms.assertAllowedSigningAlgForKey(privateJwk, algorithm)
        Kms.assertKeyAllowsVerify(publicJwk)
      } else {
        // 2. Validate alg and use for key
        Kms.assertAllowedSigningAlgForKey(publicJwk, algorithm)
        Kms.assertKeyAllowsVerify(publicJwk)
      }

      // 4. Perform the verify operation
      const verified = askarKey.verifySignature({
        message: new Uint8Array(data),
        signature: new Uint8Array(signature),
        sigType,
      })
      if (verified) {
        return {
          verified: true,
          publicJwk: keyInput.keyId
            ? this.publicJwkFromKey(askarKey, { kid: keyId })
            : (keyInput.publicJwk as Kms.KmsJwkPublic),
        }
      }

      return {
        verified: false,
      }
    } catch (error) {
      if (error instanceof Kms.KeyManagementError) throw error
      throw new Kms.KeyManagementError('Error verifying with key', { cause: error })
    } finally {
      if (askarKey) askarKey.handle.free()
    }
  }

  public async encrypt(agentContext: AgentContext, options: Kms.KmsEncryptOptions): Promise<Kms.KmsEncryptReturn> {
    const { data, encryption, key } = options

    Kms.assertSupportedEncryptionAlgorithm(encryption, askarSupportedEncryptionAlgorithms, this.backend)

    const keysToFree: Key[] = []
    try {
      let encryptionKey: Key | undefined
      let encryptedKey: Kms.KmsEncryptedKey | undefined

      // TODO: we should check if the key allows this operation
      if (key.keyId) {
        encryptionKey = (await this.getKeyAsserted(agentContext, key.keyId)).key

        keysToFree.push(encryptionKey)
      } else if (key.privateJwk) {
        if (encryption.algorithm === 'XSALSA20-POLY1305') {
          throw new Kms.KeyManagementAlgorithmNotSupportedError(
            `encryption algorithm '${encryption.algorithm}' is only supported in combination with key agreement algorithm '${Kms.KnownJwaKeyAgreementAlgorithms.ECDH_HSALSA20}'`,
            this.backend
          )
        }
        encryptionKey = this.keyFromSecretBytesAndEncryptionAlgorithm(
          TypedArrayEncoder.fromBase64(key.privateJwk.k),
          encryption.algorithm
        )
        keysToFree.push(encryptionKey)
      } else if (key.keyAgreement) {
        Kms.assertAllowedKeyDerivationAlgForKey(key.keyAgreement.externalPublicJwk, key.keyAgreement.algorithm)
        Kms.assertKeyAllowsDerive(key.keyAgreement.externalPublicJwk)
        Kms.assertSupportedKeyAgreementAlgorithm(key.keyAgreement, askarSupportedKeyAgreementAlgorithms, this.backend)

        let privateKey = key.keyAgreement.keyId
          ? (await this.getKeyAsserted(agentContext, key.keyAgreement.keyId)).key
          : undefined
        if (privateKey) keysToFree.push(privateKey)

        const privateJwk = privateKey ? this.privateJwkFromKey(privateKey) : undefined
        if (privateJwk) {
          Kms.assertJwkAsymmetric(privateJwk, key.keyAgreement.keyId)
          Kms.assertAllowedKeyDerivationAlgForKey(privateJwk, key.keyAgreement.algorithm)
          Kms.assertKeyAllowsDerive(privateJwk)

          // Special case, for DIDComm v1 we often use an X25519 for the external key
          // but we use an Ed25519 for our key
          if (key.keyAgreement.algorithm !== 'ECDH-HSALSA20') {
            Kms.assertAsymmetricJwkKeyTypeMatches(privateJwk, key.keyAgreement.externalPublicJwk)
          }
        }

        const recipientKey = this.keyFromJwk(key.keyAgreement.externalPublicJwk)
        keysToFree.push(recipientKey)

        // Special case to support DIDComm v1
        if (key.keyAgreement.algorithm === 'ECDH-HSALSA20' || encryption.algorithm === 'XSALSA20-POLY1305') {
          if (encryption.algorithm !== 'XSALSA20-POLY1305' || key.keyAgreement.algorithm !== 'ECDH-HSALSA20') {
            throw new Kms.KeyManagementAlgorithmNotSupportedError(
              `key agreement algorithm '${key.keyAgreement.algorithm}' with encryption algorithm '${encryption.algorithm}'`,
              this.backend
            )
          }

          // anonymous encryption
          if (!privateKey) {
            return {
              encrypted: new Uint8Array(
                CryptoBox.seal({
                  recipientKey,
                  message: new Uint8Array(data),
                })
              ),
            }
          }

          // Special case. For DIDComm v1 we basically use the Ed25519 key also
          // for X25519 operations.
          if (privateKey.algorithm === KeyAlgorithm.Ed25519) {
            privateKey = privateKey.convertkey({ algorithm: KeyAlgorithm.X25519 })
            keysToFree.push(privateKey)
          }

          const nonce = new Uint8Array(CryptoBox.randomNonce())
          const encrypted = new Uint8Array(
            CryptoBox.cryptoBox({
              recipientKey,
              senderKey: privateKey,
              message: new Uint8Array(data),
              nonce,
            })
          )

          return {
            encrypted,
            iv: nonce,
          }
        }

        // This should not happen, but for TS
        if (!privateKey) {
          throw new Kms.KeyManagementError('sender key is required for ECDH-ES key derivation.')
        }

        const { contentEncryptionKey, encryptedContentEncryptionKey } = deriveEncryptionKey({
          encryption,
          keyAgreement: key.keyAgreement,
          recipientKey,
          senderKey: privateKey,
        })

        encryptionKey = contentEncryptionKey
        keysToFree.push(contentEncryptionKey)
        encryptedKey = encryptedContentEncryptionKey
      } else {
        throw new Kms.KeyManagementError('Unexpected key parameter for encrypt')
      }

      if (encryption.algorithm === 'XSALSA20-POLY1305') {
        throw new Kms.KeyManagementAlgorithmNotSupportedError(
          `encryption algorithm '${encryption.algorithm}' can only be used with key agreement algorithm ECDH-HSALSA20`,
          this.backend
        )
      }

      const privateJwk = this.privateJwkFromKey(encryptionKey)
      Kms.assertKeyAllowsDerive(privateJwk)
      Kms.assertAllowedEncryptionAlgForKey(privateJwk, encryption.algorithm)
      Kms.assertKeyAllowsEncrypt(privateJwk)

      const encrypted = aeadEncrypt({
        key: encryptionKey,
        data,
        encryption,
      })

      return {
        ...encrypted,
        encryptedKey,
      }
    } catch (error) {
      if (error instanceof Kms.KeyManagementError) throw error
      throw new Kms.KeyManagementError('Error encrypting with key', { cause: error })
    } finally {
      // Clear all keys
      for (const key of keysToFree) {
        key.handle.free()
      }
    }
  }

  public async decrypt(agentContext: AgentContext, options: Kms.KmsDecryptOptions): Promise<Kms.KmsDecryptReturn> {
    const { encrypted, decryption, key } = options

    Kms.assertSupportedEncryptionAlgorithm(decryption, askarSupportedEncryptionAlgorithms, this.backend)

    const keysToFree: Key[] = []

    try {
      let decryptionKey: Key | undefined

      if (key.keyId) {
        decryptionKey = (await this.getKeyAsserted(agentContext, key.keyId)).key
        keysToFree.push(decryptionKey)
      } else if (key.privateJwk) {
        if (decryption.algorithm === 'XSALSA20-POLY1305') {
          throw new Kms.KeyManagementAlgorithmNotSupportedError(
            `decryption algorithm '${decryption.algorithm}' is only supported in combination with key agreement algorithm '${Kms.KnownJwaKeyAgreementAlgorithms.ECDH_HSALSA20}'`,
            this.backend
          )
        }
        decryptionKey = this.keyFromSecretBytesAndEncryptionAlgorithm(
          TypedArrayEncoder.fromBase64(key.privateJwk.k),
          decryption.algorithm
        )
        keysToFree.push(decryptionKey)
      } else if (key.keyAgreement) {
        if (key.keyAgreement.externalPublicJwk) {
          Kms.assertAllowedKeyDerivationAlgForKey(key.keyAgreement.externalPublicJwk, key.keyAgreement.algorithm)
          Kms.assertKeyAllowsDerive(key.keyAgreement.externalPublicJwk)
        }
        Kms.assertSupportedKeyAgreementAlgorithm(key.keyAgreement, askarSupportedKeyAgreementAlgorithms, this.backend)

        let privateKey = (await this.getKeyAsserted(agentContext, key.keyAgreement.keyId)).key
        keysToFree.push(privateKey)

        const privateJwk = this.privateJwkFromKey(privateKey)

        Kms.assertJwkAsymmetric(privateJwk, key.keyAgreement.keyId)
        Kms.assertAllowedKeyDerivationAlgForKey(privateJwk, key.keyAgreement.algorithm)
        Kms.assertKeyAllowsDerive(privateJwk)

        // Special case for ECDH-HSALSA as we can have mismatch between keys because of DIDComm v1
        if (key.keyAgreement.externalPublicJwk && key.keyAgreement.algorithm !== 'ECDH-HSALSA20') {
          Kms.assertAsymmetricJwkKeyTypeMatches(privateJwk, key.keyAgreement.externalPublicJwk)
        }

        const senderKey = key.keyAgreement.externalPublicJwk
          ? this.keyFromJwk(key.keyAgreement.externalPublicJwk)
          : undefined
        if (senderKey) keysToFree.push(senderKey)

        // Special case to support DIDComm v1
        if (key.keyAgreement.algorithm === 'ECDH-HSALSA20' || decryption.algorithm === 'XSALSA20-POLY1305') {
          if (decryption.algorithm !== 'XSALSA20-POLY1305' || key.keyAgreement.algorithm !== 'ECDH-HSALSA20') {
            throw new Kms.KeyManagementAlgorithmNotSupportedError(
              `key agreement algorithm '${key.keyAgreement.algorithm}' with encryption algorithm '${decryption.algorithm}'`,
              this.backend
            )
          }

          // Special case. For DIDComm v1 we basically use the Ed25519 key also
          // for X25519 operations.
          if (privateKey.algorithm === KeyAlgorithm.Ed25519) {
            privateKey = privateKey.convertkey({ algorithm: KeyAlgorithm.X25519 })
            keysToFree.push(privateKey)
          }

          if (!senderKey) {
            // anonymous encryption
            return {
              data: new Uint8Array(
                CryptoBox.sealOpen({
                  recipientKey: privateKey,
                  ciphertext: new Uint8Array(encrypted),
                })
              ),
            }
          }

          if (!decryption.iv) {
            throw new Kms.KeyManagementError(
              `Missing required 'iv' for key agreement algorithm ${key.keyAgreement.algorithm} and encryption algorithm ${decryption.algorithm} with sender key defined.`
            )
          }

          const decrypted = new Uint8Array(
            CryptoBox.open({
              recipientKey: privateKey,
              senderKey: senderKey,
              message: new Uint8Array(encrypted),
              nonce: new Uint8Array(decryption.iv),
            })
          )

          return {
            data: decrypted,
          }
        }

        // This should not happen, but for TS
        if (!senderKey) {
          throw new Kms.KeyManagementError('sender key is required for ECDH-ES key derivation.')
        }

        const { contentEncryptionKey } = deriveDecryptionKey({
          decryption,
          keyAgreement: key.keyAgreement,
          recipientKey: privateKey,
          senderKey,
        })

        decryptionKey = contentEncryptionKey
        keysToFree.push(contentEncryptionKey)
      } else {
        throw new Kms.KeyManagementError('Unexpected key parameter for decrypt')
      }

      if (decryption.algorithm === 'XSALSA20-POLY1305') {
        throw new Kms.KeyManagementAlgorithmNotSupportedError(
          `encryption algorithm '${decryption.algorithm}' can only be used with key agreement algorithm ECDH-HSALSA20`,
          this.backend
        )
      }

      const privateJwk = this.privateJwkFromKey(decryptionKey)
      Kms.assertKeyAllowsDerive(privateJwk)
      Kms.assertAllowedEncryptionAlgForKey(privateJwk, decryption.algorithm)
      Kms.assertKeyAllowsEncrypt(privateJwk)

      const decrypted = aeadDecrypt({
        key: decryptionKey,
        encrypted,
        decryption,
      })

      return {
        data: decrypted,
      }
    } catch (error) {
      if (error instanceof Kms.KeyManagementError) throw error
      throw new Kms.KeyManagementError('Error decrypting with key', { cause: error })
    } finally {
      // Clear all keys
      for (const key of keysToFree) {
        key.handle.free()
      }
    }
  }

  private assertedSigTypeForAlg(algorithm: Kms.KnownJwaSignatureAlgorithm): SignatureAlgorithm {
    const sigType = AskarKeyManagementService.algToSigType[algorithm]
    if (!sigType) {
      throw new Kms.KeyManagementAlgorithmNotSupportedError(
        `signing and verification with algorithm '${algorithm}'`,
        this.backend
      )
    }

    return sigType
  }

  private assertAskarAlgForJwkCrv(kty: string, crv: Kms.KmsJwkPublicEc['crv'] | Kms.KmsJwkPublicOkp['crv']) {
    const keyAlg = jwkCrvToAskarAlg[crv]
    if (!keyAlg) {
      throw new Kms.KeyManagementAlgorithmNotSupportedError(`crv '${crv}' for kty '${kty}'`, this.backend)
    }

    return keyAlg
  }

  private keyFromJwk(jwk: Kms.KmsJwkPrivate | Kms.KmsJwkPublic) {
    const key = new Key(
      askar.keyFromJwk({
        // TODO: the JWK class in JS Askar wrapper is too limiting
        // so we use this method directly. should update it
        jwk: new Uint8Array(JsonEncoder.toBuffer(jwk)) as unknown as Jwk,
      })
    )

    return key
  }

  private keyFromSecretBytesAndEncryptionAlgorithm(
    secretBytes: AnyUint8Array,
    algorithm: AskarSupportedEncryptionOptions['algorithm']
  ) {
    const askarEncryptionAlgorithm = jwkEncToAskarAlg[algorithm]
    if (!askarEncryptionAlgorithm) {
      throw new Kms.KeyManagementAlgorithmNotSupportedError(`JWA encryption algorithm '${algorithm}'`, 'askar')
    }

    return Key.fromSecretBytes({
      algorithm: askarEncryptionAlgorithm,
      secretKey: new Uint8Array(secretBytes),
    })
  }

  private publicJwkFromKey(key: Key, partialJwkPublic?: Partial<Kms.KmsJwkPublic>) {
    return Kms.publicJwkFromPrivateJwk(this.privateJwkFromKey(key, partialJwkPublic))
  }

  private privateJwkFromKey(key: Key, partialJwkPrivate?: Partial<Kms.KmsJwkPrivate>) {
    // TODO: once we support additional params we should add these here

    // TODO: the JWK class in JS Askar wrapper is too limiting
    // so we use this method directly. should update it
    // We extract alg, as Askar doesn't always use the same algs
    // biome-ignore lint/correctness/noUnusedVariables: no explanation
    const { alg, ...jwkSecret } = JsonEncoder.fromBuffer(
      askar.keyGetJwkSecret({
        localKeyHandle: key.handle,
      })
    )

    return {
      ...partialJwkPrivate,
      ...jwkSecret,
    } as Kms.KmsJwkPrivate
  }

  private async fetchAskarKey(agentContext: AgentContext, keyId: string): Promise<KeyEntryObject | null> {
    return await this.withSession(agentContext, async (session) => {
      if (!session.handle) throw Error('Cannot fetch a key with a closed session')

      // Fetch the key from the session
      const handle = await askar.sessionFetchKey({ forUpdate: false, name: keyId, sessionHandle: session.handle })
      if (!handle) return null

      // Get the key entry
      const keyEntryList = new KeyEntryList({ handle })
      const keyEntry = keyEntryList.getEntryByIndex(0)

      const keyEntryObject = keyEntry.toJson()
      keyEntryList.handle.free()

      return keyEntryObject
    })
  }

  private async getKeyAsserted(agentContext: AgentContext, keyId: string) {
    const storageKey = await this.fetchAskarKey(agentContext, keyId)
    if (!storageKey) {
      throw new Kms.KeyManagementKeyNotFoundError(keyId, [this.backend])
    }

    return storageKey
  }
}
