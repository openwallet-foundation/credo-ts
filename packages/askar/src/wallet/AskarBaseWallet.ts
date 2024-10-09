import type {
  EncryptedMessage,
  WalletConfig,
  WalletCreateKeyOptions,
  WalletSignOptions,
  UnpackedMessageContext,
  WalletVerifyOptions,
  Wallet,
  WalletConfigRekey,
  KeyPair,
  WalletExportImportConfig,
  Logger,
  SigningProviderRegistry,
  WalletDirectEncryptCompactJwtEcdhEsOptions,
} from '@credo-ts/core'
import type { Session } from '@hyperledger/aries-askar-shared'

import {
  WalletKeyExistsError,
  isValidSeed,
  isValidPrivateKey,
  JsonEncoder,
  Buffer,
  CredoError,
  WalletError,
  Key,
  TypedArrayEncoder,
  KeyBackend,
  KeyType,
  utils,
} from '@credo-ts/core'
import {
  CryptoBox,
  Store,
  Key as AskarKey,
  keyAlgFromString,
  EcdhEs,
  KeyAlgs,
  Jwk,
} from '@hyperledger/aries-askar-shared'
import BigNumber from 'bn.js'

import { importSecureEnvironment } from '../secureEnvironment'
import {
  AskarErrorCode,
  AskarKeyTypePurpose,
  isAskarError,
  isKeyTypeSupportedByAskarForPurpose,
  keyTypesSupportedByAskar,
} from '../utils'

import { didcommV1Pack, didcommV1Unpack } from './didcommV1'

const isError = (error: unknown): error is Error => error instanceof Error

export abstract class AskarBaseWallet implements Wallet {
  protected logger: Logger
  protected signingKeyProviderRegistry: SigningProviderRegistry

  public constructor(logger: Logger, signingKeyProviderRegistry: SigningProviderRegistry) {
    this.logger = logger
    this.signingKeyProviderRegistry = signingKeyProviderRegistry
  }

  /**
   * Abstract methods that need to be implemented by subclasses
   */
  public abstract isInitialized: boolean
  public abstract isProvisioned: boolean
  public abstract create(walletConfig: WalletConfig): Promise<void>
  public abstract createAndOpen(walletConfig: WalletConfig): Promise<void>
  public abstract open(walletConfig: WalletConfig): Promise<void>
  public abstract rotateKey(walletConfig: WalletConfigRekey): Promise<void>
  public abstract close(): Promise<void>
  public abstract delete(): Promise<void>
  public abstract export(exportConfig: WalletExportImportConfig): Promise<void>
  public abstract import(walletConfig: WalletConfig, importConfig: WalletExportImportConfig): Promise<void>
  public abstract dispose(): void | Promise<void>
  public abstract profile: string

  protected abstract store: Store

  /**
   * Run callback with the session provided, the session will
   * be closed once the callback resolves or rejects if it is not closed yet.
   *
   * TODO: update to new `using` syntax so we don't have to use a callback
   */
  public async withSession<Return>(callback: (session: Session) => Return): Promise<Awaited<Return>> {
    let session: Session | undefined = undefined
    try {
      session = await this.store.session(this.profile).open()

      const result = await callback(session)

      return result
    } finally {
      if (session?.handle) {
        await session.close()
      }
    }
  }

  /**
   * Run callback with a transaction. If the callback resolves the transaction
   * will be committed if the transaction is not closed yet. If the callback rejects
   * the transaction will be rolled back if the transaction is not closed yet.
   *
   * TODO: update to new `using` syntax so we don't have to use a callback
   */
  public async withTransaction<Return>(callback: (transaction: Session) => Return): Promise<Awaited<Return>> {
    let session: Session | undefined = undefined
    try {
      session = await this.store.transaction(this.profile).open()

      const result = await callback(session)

      if (session.handle) {
        await session.commit()
      }
      return result
    } catch (error) {
      if (session?.handle) {
        await session?.rollback()
      }

      throw error
    }
  }

  public get supportedKeyTypes() {
    const signingKeyProviderSupportedKeyTypes = this.signingKeyProviderRegistry.supportedKeyTypes

    return Array.from(new Set([...keyTypesSupportedByAskar, ...signingKeyProviderSupportedKeyTypes]))
  }

  /**
   * Create a key with an optional seed and keyType.
   * The keypair is also automatically stored in the wallet afterwards
   */
  public async createKey({
    seed,
    privateKey,
    keyType,
    keyId,
    keyBackend = KeyBackend.Software,
  }: WalletCreateKeyOptions): Promise<Key> {
    try {
      if (seed && privateKey) {
        throw new WalletError('Only one of seed and privateKey can be set')
      }

      if (seed && !isValidSeed(seed, keyType)) {
        throw new WalletError('Invalid seed provided')
      }

      if (privateKey && !isValidPrivateKey(privateKey, keyType)) {
        throw new WalletError('Invalid private key provided')
      }

      if (keyBackend === KeyBackend.SecureElement && keyType !== KeyType.P256) {
        throw new WalletError(`Keytype '${keyType}' is not supported for the secure element`)
      }

      if (
        isKeyTypeSupportedByAskarForPurpose(keyType, AskarKeyTypePurpose.KeyManagement) &&
        keyBackend === KeyBackend.Software
      ) {
        const algorithm = keyAlgFromString(keyType)

        // Create key
        let key: AskarKey | undefined
        try {
          const _key = privateKey
            ? AskarKey.fromSecretBytes({ secretKey: privateKey, algorithm })
            : seed
            ? AskarKey.fromSeed({ seed, algorithm })
            : AskarKey.generate(algorithm)

          // FIXME: we need to create a separate const '_key' so TS definitely knows _key is defined in the session callback.
          // This will be fixed once we use the new 'using' syntax
          key = _key

          const keyPublicBytes = key.publicBytes

          // Store key
          await this.withSession((session) =>
            session.insertKey({ key: _key, name: keyId ?? TypedArrayEncoder.toBase58(keyPublicBytes) })
          )

          key.handle.free()
          return Key.fromPublicKey(keyPublicBytes, keyType)
        } catch (error) {
          key?.handle.free()
          // Handle case where key already exists
          if (isAskarError(error, AskarErrorCode.Duplicate)) {
            throw new WalletKeyExistsError('Key already exists')
          }

          // Otherwise re-throw error
          throw error
        }
      } else if (keyBackend === KeyBackend.SecureElement && keyType === KeyType.P256) {
        const secureEnvironment = importSecureEnvironment()
        const kid = utils.uuid()

        // Generate a hardware-backed P-256 keypair
        secureEnvironment.generateKeypair(kid)
        const publicKeyBytes = secureEnvironment.getPublicBytesForKeyId(kid)
        const publicKeyBase58 = TypedArrayEncoder.toBase58(publicKeyBytes)

        await this.storeSecureEnvironmentKeyById({
          keyType,
          publicKeyBase58,
          keyId: kid,
        })

        return new Key(publicKeyBytes, keyType)
      } else {
        // Check if there is a signing key provider for the specified key type.
        if (this.signingKeyProviderRegistry.hasProviderForKeyType(keyType)) {
          const signingKeyProvider = this.signingKeyProviderRegistry.getProviderForKeyType(keyType)

          const keyPair = await signingKeyProvider.createKeyPair({ seed, privateKey })
          await this.storeKeyPair(keyPair)
          return Key.fromPublicKeyBase58(keyPair.publicKeyBase58, keyType)
        }
        throw new WalletError(`Unsupported key type: '${keyType}'`)
      }
    } catch (error) {
      // If already instance of `WalletError`, re-throw
      if (error instanceof WalletError) throw error

      if (!isError(error)) {
        throw new CredoError('Attempted to throw error, but it was not of type Error', { cause: error })
      }
      throw new WalletError(`Error creating key with key type '${keyType}': ${error.message}`, { cause: error })
    }
  }

  /**
   * sign a Buffer with an instance of a Key class
   *
   * @param data Buffer The data that needs to be signed
   * @param key Key The key that is used to sign the data
   *
   * @returns A signature for the data
   */
  public async sign({ data, key }: WalletSignOptions): Promise<Buffer> {
    let askarKey: AskarKey | null | undefined
    let keyPair: KeyPair | null | undefined

    try {
      if (isKeyTypeSupportedByAskarForPurpose(key.keyType, AskarKeyTypePurpose.KeyManagement)) {
        askarKey = await this.withSession(
          async (session) => (await session.fetchKey({ name: key.publicKeyBase58 }))?.key
        )
      }

      // FIXME: remove the custom KeyPair record now that we deprecate Indy SDK.
      // We can do this in a migration script

      // Fallback to fetching key from the non-askar storage, this is to handle the case
      // where a key wasn't supported at first by the wallet, but now is
      if (!askarKey) {
        // TODO: we should probably make retrieveKeyPair + insertKey + deleteKeyPair a transaction
        keyPair = await this.retrieveKeyPair(key.publicKeyBase58)

        // If we have the key stored in a custom record, but it is now supported by Askar,
        // we 'import' the key into askar storage and remove the custom key record
        if (keyPair && isKeyTypeSupportedByAskarForPurpose(keyPair.keyType, AskarKeyTypePurpose.KeyManagement)) {
          const _askarKey = AskarKey.fromSecretBytes({
            secretKey: TypedArrayEncoder.fromBase58(keyPair.privateKeyBase58),
            algorithm: keyAlgFromString(keyPair.keyType),
          })
          askarKey = _askarKey

          await this.withSession((session) =>
            session.insertKey({
              name: key.publicKeyBase58,
              key: _askarKey,
            })
          )

          // Now we can remove it from the custom record as we have imported it into Askar
          await this.deleteKeyPair(key.publicKeyBase58)
          keyPair = undefined
        } else {
          const { keyId } = await this.getSecureEnvironmentKey(key.publicKeyBase58)

          if (Array.isArray(data[0])) {
            throw new WalletError('Multi signature is not supported for the Secure Environment')
          }

          return Buffer.from(await importSecureEnvironment().sign(keyId, new Uint8Array(data as Buffer)))
        }
      }

      if (!askarKey && !keyPair) {
        throw new WalletError('Key entry not found')
      }

      // Not all keys are supported for signing
      if (isKeyTypeSupportedByAskarForPurpose(key.keyType, AskarKeyTypePurpose.Signing)) {
        if (!TypedArrayEncoder.isTypedArray(data)) {
          throw new WalletError(`Currently not supporting signing of multiple messages`)
        }

        askarKey =
          askarKey ??
          (keyPair
            ? AskarKey.fromSecretBytes({
                secretKey: TypedArrayEncoder.fromBase58(keyPair.privateKeyBase58),
                algorithm: keyAlgFromString(keyPair.keyType),
              })
            : undefined)

        if (!askarKey) {
          throw new WalletError('Key entry not found')
        }

        const signed = askarKey.signMessage({ message: data as Buffer })
        return Buffer.from(signed)
      } else {
        // Check if there is a signing key provider for the specified key type.
        if (this.signingKeyProviderRegistry.hasProviderForKeyType(key.keyType)) {
          const signingKeyProvider = this.signingKeyProviderRegistry.getProviderForKeyType(key.keyType)

          // It could be that askar supports storing the key, but can't sign with it
          // (in case of bls)
          const privateKeyBase58 =
            keyPair?.privateKeyBase58 ??
            (askarKey?.secretBytes ? TypedArrayEncoder.toBase58(askarKey.secretBytes) : undefined)

          if (!privateKeyBase58) {
            throw new WalletError('Key entry not found')
          }
          const signed = await signingKeyProvider.sign({
            data,
            privateKeyBase58: privateKeyBase58,
            publicKeyBase58: key.publicKeyBase58,
          })

          return signed
        }
        throw new WalletError(`Unsupported keyType: ${key.keyType}`)
      }
    } catch (error) {
      if (!isError(error)) {
        throw new CredoError('Attempted to throw error, but it was not of type Error', { cause: error })
      }
      throw new WalletError(`Error signing data with verkey ${key.publicKeyBase58}. ${error.message}`, { cause: error })
    } finally {
      askarKey?.handle.free()
    }
  }

  /**
   * Verify the signature with the data and the used key
   *
   * @param data Buffer The data that has to be confirmed to be signed
   * @param key Key The key that was used in the signing process
   * @param signature Buffer The signature that was created by the signing process
   *
   * @returns A boolean whether the signature was created with the supplied data and key
   *
   * @throws {WalletError} When it could not do the verification
   * @throws {WalletError} When an unsupported keytype is used
   */
  public async verify({ data, key, signature }: WalletVerifyOptions): Promise<boolean> {
    let askarKey: AskarKey | undefined
    try {
      if (isKeyTypeSupportedByAskarForPurpose(key.keyType, AskarKeyTypePurpose.Signing)) {
        if (!TypedArrayEncoder.isTypedArray(data)) {
          throw new WalletError(`Currently not supporting verification of multiple messages`)
        }

        askarKey = AskarKey.fromPublicBytes({
          algorithm: keyAlgFromString(key.keyType),
          publicKey: key.publicKey,
        })
        const verified = askarKey.verifySignature({ message: data as Buffer, signature })
        askarKey.handle.free()
        return verified
      } else if (this.signingKeyProviderRegistry.hasProviderForKeyType(key.keyType)) {
        // Check if there is a signing key provider for the specified key type.
        const signingKeyProvider = this.signingKeyProviderRegistry.getProviderForKeyType(key.keyType)
        const signed = await signingKeyProvider.verify({
          data,
          signature,
          publicKeyBase58: key.publicKeyBase58,
        })

        return signed
      } else {
        throw new WalletError(`Unsupported keyType: ${key.keyType}`)
      }
    } catch (error) {
      askarKey?.handle.free()
      if (!isError(error)) {
        throw new CredoError('Attempted to throw error, but it was not of type Error', { cause: error })
      }
      throw new WalletError(`Error verifying signature of data signed with verkey ${key.publicKeyBase58}`, {
        cause: error,
      })
    }
  }

  /**
   * Pack a message using DIDComm V1 algorithm
   *
   * @param payload message to send
   * @param recipientKeys array containing recipient keys in base58
   * @param senderVerkey sender key in base58
   * @returns JWE Envelope to send
   */
  public async pack(
    payload: Record<string, unknown>,
    recipientKeys: string[],
    senderVerkey?: string // in base58
  ): Promise<EncryptedMessage> {
    const senderKey = senderVerkey
      ? await this.withSession((session) => session.fetchKey({ name: senderVerkey }))
      : undefined

    try {
      if (senderVerkey && !senderKey) {
        throw new WalletError(`Sender key not found`)
      }

      const envelope = didcommV1Pack(payload, recipientKeys, senderKey?.key)

      return envelope
    } finally {
      senderKey?.key.handle.free()
    }
  }

  /**
   * Unpacks a JWE Envelope coded using DIDComm V1 algorithm
   *
   * @param messagePackage JWE Envelope
   * @returns UnpackedMessageContext with plain text message, sender key and recipient key
   */
  public async unpack(messagePackage: EncryptedMessage): Promise<UnpackedMessageContext> {
    const protectedJson = JsonEncoder.fromBase64(messagePackage.protected)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recipientKids: string[] = protectedJson.recipients.map((r: any) => r.header.kid)

    // TODO: how long should sessions last? Just for the duration of the unpack? Or should each item in the recipientKids get a separate session?
    const returnValue = await this.withSession(async (session) => {
      for (const recipientKid of recipientKids) {
        const recipientKeyEntry = await session.fetchKey({ name: recipientKid })
        try {
          if (recipientKeyEntry) {
            return didcommV1Unpack(messagePackage, recipientKeyEntry.key)
          }
        } finally {
          recipientKeyEntry?.key.handle.free()
        }
      }
    })

    if (!returnValue) {
      throw new WalletError('No corresponding recipient key found')
    }

    return returnValue
  }

  /**
   * Method that enables JWE encryption using ECDH-ES and AesA256Gcm and returns it as a compact JWE.
   * This method is specifically added to support OpenID4VP response encryption using JARM and should later be
   * refactored into a more generic method that supports encryption/decryption.
   *
   * @returns compact JWE
   */
  public async directEncryptCompactJweEcdhEs({
    recipientKey,
    encryptionAlgorithm,
    apu,
    apv,
    data,
    header,
  }: WalletDirectEncryptCompactJwtEcdhEsOptions) {
    if (encryptionAlgorithm !== 'A256GCM') {
      throw new WalletError(`Encryption algorithm ${encryptionAlgorithm} is not supported. Only A256GCM is supported`)
    }

    // Only one supported for now
    const encAlg = KeyAlgs.AesA256Gcm

    // Create ephemeral key
    const ephemeralKey = AskarKey.generate(keyAlgFromString(recipientKey.keyType))

    const _header = {
      ...header,
      apv,
      apu,
      enc: 'A256GCM',
      alg: 'ECDH-ES',
      epk: ephemeralKey.jwkPublic,
    }

    const encodedHeader = JsonEncoder.toBase64URL(_header)

    const ecdh = new EcdhEs({
      algId: Uint8Array.from(Buffer.from(encryptionAlgorithm)),
      apu: apu ? Uint8Array.from(TypedArrayEncoder.fromBase64(apu)) : Uint8Array.from([]),
      apv: apv ? Uint8Array.from(TypedArrayEncoder.fromBase64(apv)) : Uint8Array.from([]),
    })

    const { ciphertext, tag, nonce } = ecdh.encryptDirect({
      encAlg,
      ephemeralKey,
      message: Uint8Array.from(data),
      recipientKey: AskarKey.fromPublicBytes({
        algorithm: keyAlgFromString(recipientKey.keyType),
        publicKey: recipientKey.publicKey,
      }),
      // NOTE: aad is bytes of base64url encoded string. It SHOULD NOT be decoded as base64
      aad: Uint8Array.from(Buffer.from(encodedHeader)),
    })

    const compactJwe = `${encodedHeader}..${TypedArrayEncoder.toBase64URL(nonce)}.${TypedArrayEncoder.toBase64URL(
      ciphertext
    )}.${TypedArrayEncoder.toBase64URL(tag)}`
    return compactJwe
  }

  /**
   * Method that enables JWE decryption using ECDH-ES and AesA256Gcm and returns it as plaintext buffer with the header.
   * The apv and apu values are extracted from the heaader, and thus on a higher level it should be checked that these
   * values are correct.
   */
  public async directDecryptCompactJweEcdhEs({
    compactJwe,
    recipientKey,
  }: {
    compactJwe: string
    recipientKey: Key
  }): Promise<{ data: Buffer; header: Record<string, unknown> }> {
    // encryption key is not used (we don't use key wrapping)
    const [encodedHeader /* encryptionKey */, , encodedIv, encodedCiphertext, encodedTag] = compactJwe.split('.')

    const header = JsonEncoder.fromBase64(encodedHeader)

    if (header.alg !== 'ECDH-ES') {
      throw new WalletError('Only ECDH-ES alg value is supported')
    }
    if (header.enc !== 'A256GCM') {
      throw new WalletError('Only A256GCM enc value is supported')
    }
    if (!header.epk || typeof header.epk !== 'object') {
      throw new WalletError('header epk value must contain a JWK')
    }

    // NOTE: we don't support custom key storage record at the moment.
    let askarKey: AskarKey | null | undefined
    if (isKeyTypeSupportedByAskarForPurpose(recipientKey.keyType, AskarKeyTypePurpose.KeyManagement)) {
      askarKey = await this.withSession(
        async (session) => (await session.fetchKey({ name: recipientKey.publicKeyBase58 }))?.key
      )
    }
    if (!askarKey) {
      throw new WalletError('Key entry not found')
    }

    // Only one supported for now
    const encAlg = KeyAlgs.AesA256Gcm

    const ecdh = new EcdhEs({
      algId: Uint8Array.from(Buffer.from(header.enc)),
      apu: header.apu ? Uint8Array.from(TypedArrayEncoder.fromBase64(header.apu)) : Uint8Array.from([]),
      apv: header.apv ? Uint8Array.from(TypedArrayEncoder.fromBase64(header.apv)) : Uint8Array.from([]),
    })

    const plaintext = ecdh.decryptDirect({
      nonce: TypedArrayEncoder.fromBase64(encodedIv),
      ciphertext: TypedArrayEncoder.fromBase64(encodedCiphertext),
      encAlg,
      ephemeralKey: Jwk.fromJson(header.epk),
      recipientKey: askarKey,
      tag: TypedArrayEncoder.fromBase64(encodedTag),
      // NOTE: aad is bytes of base64url encoded string. It SHOULD NOT be decoded as base64
      aad: TypedArrayEncoder.fromString(encodedHeader),
    })

    return { data: Buffer.from(plaintext), header }
  }

  public async generateNonce(): Promise<string> {
    try {
      // generate an 80-bit nonce suitable for AnonCreds proofs
      const nonce = CryptoBox.randomNonce().slice(0, 10)
      return new BigNumber(nonce).toString()
    } catch (error) {
      if (!isError(error)) {
        throw new CredoError('Attempted to throw error, but it was not of type Error', { cause: error })
      }
      throw new WalletError('Error generating nonce', { cause: error })
    }
  }

  public getRandomValues(length: number): Uint8Array {
    try {
      const buffer = new Uint8Array(length)
      const CBOX_NONCE_LENGTH = 24

      const genCount = Math.ceil(length / CBOX_NONCE_LENGTH)
      const buf = new Uint8Array(genCount * CBOX_NONCE_LENGTH)
      for (let i = 0; i < genCount; i++) {
        const randomBytes = CryptoBox.randomNonce()
        buf.set(randomBytes, CBOX_NONCE_LENGTH * i)
      }
      buffer.set(buf.subarray(0, length))

      return buffer
    } catch (error) {
      if (!isError(error)) {
        throw new CredoError('Attempted to throw error, but it was not of type Error', { cause: error })
      }
      throw new WalletError('Error generating nonce', { cause: error })
    }
  }

  public async generateWalletKey() {
    try {
      return Store.generateRawKey()
    } catch (error) {
      throw new WalletError('Error generating wallet key', { cause: error })
    }
  }

  private async retrieveKeyPair(publicKeyBase58: string): Promise<KeyPair | null> {
    try {
      const entryObject = await this.withSession((session) =>
        session.fetch({ category: 'KeyPairRecord', name: `key-${publicKeyBase58}` })
      )

      if (!entryObject) return null

      return JsonEncoder.fromString(entryObject?.value as string) as KeyPair
    } catch (error) {
      throw new WalletError('Error retrieving KeyPair record', { cause: error })
    }
  }

  private async getSecureEnvironmentKey(keyId: string): Promise<{ keyId: string }> {
    try {
      const entryObject = await this.withSession((session) =>
        session.fetch({ category: 'SecureEnvironmentKeyRecord', name: keyId })
      )

      return JsonEncoder.fromString(entryObject?.value as string) as { keyId: string }
    } catch (error) {
      throw new WalletError('Error retrieving Secure Environment record', { cause: error })
    }
  }

  private async deleteKeyPair(publicKeyBase58: string): Promise<void> {
    try {
      await this.withSession((session) => session.remove({ category: 'KeyPairRecord', name: `key-${publicKeyBase58}` }))
    } catch (error) {
      throw new WalletError('Error removing KeyPair record', { cause: error })
    }
  }

  private async storeKeyPair(keyPair: KeyPair): Promise<void> {
    try {
      await this.withSession((session) =>
        session.insert({
          category: 'KeyPairRecord',
          name: `key-${keyPair.publicKeyBase58}`,
          value: JSON.stringify(keyPair),
          tags: {
            keyType: keyPair.keyType,
          },
        })
      )
    } catch (error) {
      if (isAskarError(error, AskarErrorCode.Duplicate)) {
        throw new WalletKeyExistsError('Key already exists')
      }
      throw new WalletError('Error saving KeyPair record', { cause: error })
    }
  }

  private async storeSecureEnvironmentKeyById(options: {
    keyId: string
    publicKeyBase58: string
    keyType: KeyType
  }): Promise<void> {
    try {
      await this.withSession((session) =>
        session.insert({
          category: 'SecureEnvironmentKeyRecord',
          name: options.publicKeyBase58,
          value: JSON.stringify(options),
          tags: {
            keyType: options.keyType,
          },
        })
      )
    } catch (error) {
      if (isAskarError(error, AskarErrorCode.Duplicate)) {
        throw new WalletKeyExistsError('Key already exists')
      }
      throw new WalletError('Error saving SecureEnvironment record', { cause: error })
    }
  }
}
