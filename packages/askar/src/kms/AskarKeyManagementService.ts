import { type AgentContext, JsonEncoder, Kms, TypedArrayEncoder, utils } from '@credo-ts/core'
import { p521 } from '@noble/curves/nist.js'
import type { JwkProps, KeyEntryObject, Session } from '@openwallet-foundation/askar-shared'
import {
  CryptoBox,
  Jwk,
  Key,
  KeyAlgorithm,
  KeyEntryList,
  SignatureAlgorithm,
} from '@openwallet-foundation/askar-shared'
import { AskarModuleConfig } from '../AskarModuleConfig'
import { AskarStoreManager } from '../AskarStoreManager'
import { AskarErrorCode, isAskarError, jwkCrvToAskarAlg, jwkEncToAskarAlg } from '../utils'
import { aeadDecrypt } from './crypto/decrypt'
import {
  type AskarEcdhKeyAgreementEncryptOptions,
  askarSupportedKeyAgreementAlgorithms,
  deriveDecryptionKey,
  encryptEcdh,
} from './crypto/deriveKey'
import { type AskarSupportedEncryptionOptions, aeadEncrypt } from './crypto/encrypt'
import { askarSupportedHpkeAlgorithms, hpkeOpen, hpkeSeal } from './crypto/hpke'
import { randomBytes } from './crypto/randomBytes'

const askarSymmetricKeyAlgorithms: KeyAlgorithm[] = Object.values(jwkEncToAskarAlg)

const askarSupportedEncryptionAlgorithms = [
  ...(Object.keys(jwkEncToAskarAlg) as Array<keyof typeof jwkEncToAskarAlg>),
  'XSALSA20-POLY1305',
] satisfies Array<Kms.KnownJwaContentEncryptionAlgorithm | Kms.KnownJwaKeyEncryptionAlgorithm>

export class AskarKeyManagementService implements Kms.KeyManagementService {
  public static readonly backend = 'askar'
  public readonly backend = AskarKeyManagementService.backend

  private static algToSigType: Partial<Record<Kms.KnownJwaSignatureAlgorithm, SignatureAlgorithm>> = {
    EdDSA: SignatureAlgorithm.EdDSA,
    Ed25519: SignatureAlgorithm.EdDSA,
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
      if (operation.operation === 'verify' && operation.algorithm === 'ES512') return true

      return AskarKeyManagementService.algToSigType[operation.algorithm] !== undefined
    }

    if (operation.operation === 'encrypt' || operation.operation === 'decrypt') {
      const encryption = operation.operation === 'encrypt' ? operation.encryption : operation.decryption
      const { keyAgreement } = operation
      const publicJwks = keyAgreement ? Kms.keyAgreementPublicJwks(keyAgreement) : []

      // Askar can only perform key agreement with curves it supports. We also can't create the
      // ephemeral key for e.g. ECDH-ES if the curve is not supported.
      if (publicJwks.some((jwk) => jwkCrvToAskarAlg[jwk.crv] === undefined)) {
        return false
      }

      // HPKE is an integrated encryption mode: the suite fixes the AEAD, so the HPKE key agreement
      // algorithm is all there is to check.
      if (encryption.algorithm === 'HPKE') {
        if (!operation.keyAgreement || !Kms.isJwaHpkeAlgorithm(operation.keyAgreement.algorithm)) return false

        return askarSupportedHpkeAlgorithms.includes(
          operation.keyAgreement.algorithm as (typeof askarSupportedHpkeAlgorithms)[number]
        )
      }

      if (
        !askarSupportedEncryptionAlgorithms.includes(
          encryption.algorithm as (typeof askarSupportedEncryptionAlgorithms)[number]
        )
      ) {
        return false
      }
      if (!keyAgreement) return true

      // Askar's ECDH-ES derivation (askar-crypto/src/kdf/ecdh_es.rs) caps the key at 32 bytes, A256CBC-HS512 needs 64
      if (keyAgreement.algorithm === 'ECDH-ES' && encryption.algorithm === 'A256CBC-HS512') return false

      return (
        askarSupportedKeyAgreementAlgorithms.includes(
          keyAgreement.algorithm as (typeof askarSupportedKeyAgreementAlgorithms)[number]
        ) && publicJwks.every((jwk) => Kms.supportedKeyDerivationAlgsForKey(jwk).includes(keyAgreement.algorithm))
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

    try {
      return this.publicJwkFromKey(agentContext, key.key, { kid: keyId })
    } finally {
      key.key?.handle.free()
    }
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

      const publicJwk = this.publicJwkFromKey(agentContext, _key, { kid }) as Kms.KmsCreateKeyReturn<Type>['publicJwk']
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
      const publicJwk = this.publicJwkFromKey(agentContext, key.key, { kid: keyId })
      const privateJwk = this.privateJwkFromKey(agentContext, key.key, { kid: keyId })

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

    if (algorithm === 'ES512') {
      let askarKey: Key | undefined
      try {
        let publicJwk: Kms.KmsJwkPublic | undefined = keyInput.publicJwk
        if (keyInput.keyId) {
          askarKey = (await this.getKeyAsserted(agentContext, keyInput.keyId)).key
          publicJwk = this.publicJwkFromKey(agentContext, askarKey, { kid: keyInput.keyId })
        }

        if (publicJwk?.kty === 'EC' && publicJwk.crv === 'P-521') {
          Kms.assertAllowedSigningAlgForKey(publicJwk, algorithm)
          Kms.assertKeyAllowsVerify(publicJwk)
          const jwk = Kms.PublicJwk.fromPublicJwk(publicJwk)
          if (!jwk.is(Kms.P521PublicJwk)) {
            throw new Kms.KeyManagementError('Unable to convert P-521 public JWK for verification')
          }

          return p521.verify(signature, data, jwk.publicKey.publicKey, { lowS: false })
            ? { verified: true, publicJwk }
            : { verified: false }
        }
      } catch (error) {
        if (error instanceof Kms.KeyManagementError) throw error
        throw new Kms.KeyManagementError('Error verifying with key', { cause: error })
      } finally {
        askarKey?.handle.free()
      }
    }

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
      const publicJwk = this.publicJwkFromKey(agentContext, askarKey, { kid: keyId })

      // For symmetric verificdation we need the private key
      if (publicJwk.kty === 'oct') {
        const privateJwk = this.privateJwkFromKey(agentContext, askarKey, { kid: keyId })

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
            ? this.publicJwkFromKey(agentContext, askarKey, { kid: keyId })
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

    if (encryption.algorithm === 'HPKE') {
      if (!key.keyAgreement || !Kms.isKmsKeyAgreementEncryptHpke(key.keyAgreement)) {
        throw new Kms.KeyManagementError(
          `Encryption algorithm 'HPKE' can only be used with an integrated-encryption HPKE key agreement algorithm`
        )
      }

      const { keyAgreement } = key
      Kms.assertAllowedKeyDerivationAlgForKey(keyAgreement.externalPublicJwk, keyAgreement.algorithm)
      Kms.assertKeyAllowsDerive(keyAgreement.externalPublicJwk)

      try {
        return await hpkeSeal({
          algorithm: keyAgreement.algorithm,
          recipientPublicJwk: keyAgreement.externalPublicJwk,
          data,
          info: keyAgreement.info,
          aad: encryption.aad,
        })
      } catch (error) {
        if (error instanceof Kms.KeyManagementError) throw error
        throw new Kms.KeyManagementError('Error encrypting with key', { cause: error })
      }
    }

    Kms.assertSupportedEncryptionAlgorithm(encryption, askarSupportedEncryptionAlgorithms, this.backend)

    if (key.keyAgreement) {
      Kms.assertSupportedKeyAgreementAlgorithm(key.keyAgreement, askarSupportedKeyAgreementAlgorithms, this.backend)

      if (key.keyAgreement.algorithm !== 'ECDH-HSALSA20' && encryption.algorithm !== 'XSALSA20-POLY1305') {
        return await this.encryptWithEcdh(agentContext, key.keyAgreement, encryption, data)
      }
    }

    const keysToFree: Key[] = []
    try {
      let encryptionKey: Key | undefined

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
          TypedArrayEncoder.fromBase64Url(key.privateJwk.k),
          encryption.algorithm
        )
        keysToFree.push(encryptionKey)
      } else if (key.keyAgreement) {
        const { keyAgreement } = key
        // Special case to support DIDComm v1
        if (encryption.algorithm !== 'XSALSA20-POLY1305' || keyAgreement.algorithm !== 'ECDH-HSALSA20') {
          throw new Kms.KeyManagementAlgorithmNotSupportedError(
            `key agreement algorithm '${keyAgreement.algorithm}' with encryption algorithm '${encryption.algorithm}'`,
            this.backend
          )
        }

        Kms.assertAllowedKeyDerivationAlgForKey(keyAgreement.externalPublicJwk, keyAgreement.algorithm)
        Kms.assertKeyAllowsDerive(keyAgreement.externalPublicJwk)

        let privateKey = keyAgreement.keyId
          ? (await this.getKeyAsserted(agentContext, keyAgreement.keyId)).key
          : undefined
        if (privateKey) {
          keysToFree.push(privateKey)

          const privateJwk = this.privateJwkFromKey(agentContext, privateKey)
          Kms.assertJwkAsymmetric(privateJwk, keyAgreement.keyId)
          Kms.assertAllowedKeyDerivationAlgForKey(privateJwk, keyAgreement.algorithm)
          Kms.assertKeyAllowsDerive(privateJwk)
        }

        const recipientKey = this.keyFromJwk(agentContext, keyAgreement.externalPublicJwk)
        keysToFree.push(recipientKey)

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
      } else {
        throw new Kms.KeyManagementError('Unexpected key parameter for encrypt')
      }

      if (encryption.algorithm === 'XSALSA20-POLY1305') {
        throw new Kms.KeyManagementAlgorithmNotSupportedError(
          `encryption algorithm '${encryption.algorithm}' can only be used with key agreement algorithm ECDH-HSALSA20`,
          this.backend
        )
      }

      if (typeof encryption.aad === 'function') {
        throw new Kms.KeyManagementError(`'encryption.aad' can only be a callback with ECDH key agreement`)
      }

      const privateJwk = this.privateJwkFromKey(agentContext, encryptionKey)
      Kms.assertKeyAllowsDerive(privateJwk)
      Kms.assertAllowedEncryptionAlgForKey(privateJwk, encryption.algorithm)
      Kms.assertKeyAllowsEncrypt(privateJwk)

      return aeadEncrypt({
        key: encryptionKey,
        data,
        encryption,
        aad: encryption.aad,
      })
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

  private async encryptWithEcdh(
    agentContext: AgentContext,
    keyAgreement: AskarEcdhKeyAgreementEncryptOptions,
    encryption: AskarSupportedEncryptionOptions,
    data: Uint8Array
  ): Promise<Kms.KmsEncryptReturn> {
    const recipientJwks = Kms.keyAgreementPublicJwks(keyAgreement)
    for (const recipientJwk of recipientJwks) {
      Kms.assertAllowedKeyDerivationAlgForKey(recipientJwk, keyAgreement.algorithm)
      Kms.assertKeyAllowsDerive(recipientJwk)
    }

    const keysToFree: Key[] = []
    try {
      let senderKey: Key | undefined
      if (keyAgreement.algorithm === 'ECDH-1PU+A256KW') {
        senderKey = (await this.getKeyAsserted(agentContext, keyAgreement.keyId)).key
        keysToFree.push(senderKey)

        const senderPrivateJwk = this.privateJwkFromKey(agentContext, senderKey)
        Kms.assertJwkAsymmetric(senderPrivateJwk, keyAgreement.keyId)
        Kms.assertAllowedKeyDerivationAlgForKey(senderPrivateJwk, keyAgreement.algorithm)
        Kms.assertKeyAllowsDerive(senderPrivateJwk)
        Kms.assertAsymmetricJwkKeyTypeMatches(senderPrivateJwk, recipientJwks[0])
      }

      const ephemeralKey = Key.generate(this.assertAskarAlgForJwkCrv(recipientJwks[0].kty, recipientJwks[0].crv))
      keysToFree.push(ephemeralKey)
      const ephemeralPublicJwk = this.publicJwkFromKey(agentContext, ephemeralKey) as Kms.KmsJwkPublicEcdh

      // Called outside the try below, so errors from the callback reach the caller as they are
      const aad = typeof encryption.aad === 'function' ? encryption.aad({ ephemeralPublicJwk }) : encryption.aad
      if (aad !== undefined && !(aad instanceof Uint8Array)) {
        throw new Kms.KeyManagementError(`'encryption.aad' callback must return a Uint8Array`)
      }

      try {
        const recipientKeys = recipientJwks.map((recipientJwk) => {
          const recipientKey = this.keyFromJwk(agentContext, recipientJwk)
          keysToFree.push(recipientKey)
          return recipientKey
        })

        return {
          ...encryptEcdh({
            askar: this.getAskar(agentContext),
            keyAgreement,
            encryption,
            aad,
            ephemeralKey,
            senderKey,
            recipientKeys,
            data,
          }),
          ephemeralPublicJwk,
        }
      } catch (error) {
        if (error instanceof Kms.KeyManagementError) throw error
        throw new Kms.KeyManagementError('Error encrypting with key', { cause: error })
      }
    } finally {
      for (const key of keysToFree) {
        key.handle.free()
      }
    }
  }

  public async decrypt(agentContext: AgentContext, options: Kms.KmsDecryptOptions): Promise<Kms.KmsDecryptReturn> {
    const { encrypted, decryption, key } = options

    if (decryption.algorithm === 'HPKE') {
      if (!key.keyAgreement || !Kms.isKmsKeyAgreementDecryptHpke(key.keyAgreement)) {
        throw new Kms.KeyManagementError(
          `Decryption algorithm 'HPKE' can only be used with an integrated-encryption HPKE key agreement algorithm`
        )
      }

      const { keyAgreement } = key
      const recipientKey = (await this.getKeyAsserted(agentContext, keyAgreement.keyId)).key

      try {
        const recipientPublicJwk = this.publicJwkFromKey(agentContext, recipientKey)
        Kms.assertJwkAsymmetric(recipientPublicJwk, keyAgreement.keyId)
        Kms.assertAllowedKeyDerivationAlgForKey(recipientPublicJwk, keyAgreement.algorithm)
        Kms.assertKeyAllowsDerive(recipientPublicJwk)

        return {
          data: await hpkeOpen({
            algorithm: keyAgreement.algorithm,
            recipientKey,
            recipientPublicJwk,
            encapsulatedKey: keyAgreement.encapsulatedKey,
            encrypted,
            info: keyAgreement.info,
            aad: decryption.aad,
          }),
        }
      } catch (error) {
        if (error instanceof Kms.KeyManagementError) throw error
        throw new Kms.KeyManagementError('Error decrypting with key', { cause: error })
      } finally {
        recipientKey.handle.free()
      }
    }

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
          TypedArrayEncoder.fromBase64Url(key.privateJwk.k),
          decryption.algorithm
        )
        keysToFree.push(decryptionKey)
      } else if (key.keyAgreement) {
        // Narrows away the integrated-encryption HPKE algorithms, which are handled above
        Kms.assertSupportedKeyAgreementAlgorithm(key.keyAgreement, askarSupportedKeyAgreementAlgorithms, this.backend)
        const { keyAgreement } = key

        const publicJwks = Kms.keyAgreementPublicJwks(keyAgreement)
        for (const publicJwk of publicJwks) {
          Kms.assertAllowedKeyDerivationAlgForKey(publicJwk, keyAgreement.algorithm)
          Kms.assertKeyAllowsDerive(publicJwk)
        }

        let privateKey = (await this.getKeyAsserted(agentContext, keyAgreement.keyId)).key
        keysToFree.push(privateKey)

        const privateJwk = this.privateJwkFromKey(agentContext, privateKey)

        Kms.assertJwkAsymmetric(privateJwk, keyAgreement.keyId)
        Kms.assertAllowedKeyDerivationAlgForKey(privateJwk, keyAgreement.algorithm)
        Kms.assertKeyAllowsDerive(privateJwk)

        // Special case for ECDH-HSALSA as we can have mismatch between keys because of DIDComm v1
        if (keyAgreement.algorithm !== 'ECDH-HSALSA20') {
          for (const publicJwk of publicJwks) Kms.assertAsymmetricJwkKeyTypeMatches(privateJwk, publicJwk)
        }

        // Special case to support DIDComm v1
        if (keyAgreement.algorithm === 'ECDH-HSALSA20' || decryption.algorithm === 'XSALSA20-POLY1305') {
          if (decryption.algorithm !== 'XSALSA20-POLY1305' || keyAgreement.algorithm !== 'ECDH-HSALSA20') {
            throw new Kms.KeyManagementAlgorithmNotSupportedError(
              `key agreement algorithm '${keyAgreement.algorithm}' with encryption algorithm '${decryption.algorithm}'`,
              this.backend
            )
          }

          // Special case. For DIDComm v1 we basically use the Ed25519 key also
          // for X25519 operations.
          if (privateKey.algorithm === KeyAlgorithm.Ed25519) {
            privateKey = privateKey.convertkey({ algorithm: KeyAlgorithm.X25519 })
            keysToFree.push(privateKey)
          }

          if (!keyAgreement.senderPublicJwk) {
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
              `Missing required 'iv' for key agreement algorithm ${keyAgreement.algorithm} and encryption algorithm ${decryption.algorithm} with sender key defined.`
            )
          }

          const senderKey = this.keyFromJwk(agentContext, keyAgreement.senderPublicJwk)
          keysToFree.push(senderKey)

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

        const ephemeralKey = this.keyFromJwk(agentContext, keyAgreement.ephemeralPublicJwk)
        keysToFree.push(ephemeralKey)

        const senderKey =
          keyAgreement.algorithm === 'ECDH-1PU+A256KW'
            ? this.keyFromJwk(agentContext, keyAgreement.senderPublicJwk)
            : undefined
        if (senderKey) keysToFree.push(senderKey)

        const { contentEncryptionKey } = deriveDecryptionKey({
          askar: this.getAskar(agentContext),
          decryption,
          keyAgreement,
          recipientKey: privateKey,
          ephemeralKey,
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

      const privateJwk = this.privateJwkFromKey(agentContext, decryptionKey)
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

  private keyFromJwk(agentContext: AgentContext, jwk: Kms.KmsJwkPrivate | Kms.KmsJwkPublic) {
    const key = new Key(
      this.getAskar(agentContext).keyFromJwk({
        // TODO: the JWK class in JS Askar wrapper is too limiting
        // so we use this method directly. should update it
        jwk: new Uint8Array(JsonEncoder.toUint8Array(jwk)) as unknown as Jwk,
      })
    )

    return key
  }

  private keyFromSecretBytesAndEncryptionAlgorithm(
    secretBytes: Uint8Array,
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

  private publicJwkFromKey(agentContext: AgentContext, key: Key, partialJwkPublic?: Partial<Kms.KmsJwkPublic>) {
    // Askar has no public jwk representation for symmetric keys, and there's nothing
    // public about them besides the key type
    if (askarSymmetricKeyAlgorithms.includes(key.algorithm)) {
      return Kms.publicJwkFromPrivateJwk({ ...partialJwkPublic, kty: 'oct' } as Kms.KmsJwkPublic)
    }

    // TODO: the JWK class in JS Askar wrapper is too limiting
    // so we use this method directly. should update it
    // We extract alg, as Askar doesn't always use the same algs
    const { alg, ...jwkPublic } = JSON.parse(
      this.getAskar(agentContext).keyGetJwkPublic({
        localKeyHandle: key.handle,
        algorithm: key.algorithm,
      })
    )

    return Kms.publicJwkFromPrivateJwk({ ...partialJwkPublic, ...jwkPublic } as Kms.KmsJwkPublic)
  }

  private privateJwkFromKey(agentContext: AgentContext, key: Key, partialJwkPrivate?: Partial<Kms.KmsJwkPrivate>) {
    // TODO: once we support additional params we should add these here

    // TODO: the JWK class in JS Askar wrapper is too limiting
    // so we use this method directly. should update it
    // We extract alg, as Askar doesn't always use the same algs
    const { alg, ...jwkSecret } = JsonEncoder.fromUint8Array(
      this.getAskar(agentContext).keyGetJwkSecret({
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
      const handle = await this.getAskar(agentContext).sessionFetchKey({
        forUpdate: false,
        name: keyId,
        sessionHandle: session.handle,
      })
      if (!handle) return null

      // Get the key entry
      const keyEntryList = new KeyEntryList({ handle })
      try {
        return keyEntryList.getEntryByIndex(0).toJson()
      } finally {
        keyEntryList.handle.free()
      }
    })
  }

  private async getKeyAsserted(agentContext: AgentContext, keyId: string) {
    const storageKey = await this.fetchAskarKey(agentContext, keyId)
    if (!storageKey) {
      throw new Kms.KeyManagementKeyNotFoundError(keyId, [this.backend])
    }

    return storageKey
  }

  private getAskar(agentContext: AgentContext) {
    return agentContext.resolve(AskarModuleConfig).askar
  }
}
