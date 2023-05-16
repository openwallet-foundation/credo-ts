import type {
  EncryptedMessage,
  KeyPair,
  UnpackedMessageContext,
  Wallet,
  WalletConfig,
  WalletConfigRekey,
  WalletCreateKeyOptions,
  WalletExportImportConfig,
  WalletPackOptions,
  WalletSignOptions,
  WalletVerifyOptions,
} from '@aries-framework/core'
import type { KeyEntryObject, Session } from '@hyperledger/aries-askar-shared'

import {
  AriesFrameworkError,
  Buffer,
  DidCommMessageVersion,
  DidCommV2EncryptionAlgs,
  DidCommV2KeyProtectionAlgs,
  DidCommV2Types,
  DidKey,
  FileSystem,
  InjectionSymbols,
  isDidCommV1EncryptedEnvelope,
  isValidPrivateKey,
  isValidSeed,
  JsonEncoder,
  JsonTransformer,
  JweEnvelope,
  JweEnvelopeBuilder,
  JweRecipient,
  Key,
  KeyDerivationMethod,
  KeyProviderRegistry,
  KeyType,
  Logger,
  TypedArrayEncoder,
  WalletDuplicateError,
  WalletError,
  WalletExportPathExistsError,
  WalletInvalidKeyError,
  WalletKeyExistsError,
  WalletNotFoundError,
} from '@aries-framework/core'
import {
  CryptoBox,
  Ecdh1PU,
  EcdhEs,
  Key as AskarKey,
  keyAlgFromString,
  KeyAlgs,
  Store,
} from '@hyperledger/aries-askar-shared'
import { Jwk } from '@hyperledger/aries-askar-shared/build/crypto/Jwk'
import BigNumber from 'bn.js'
import { inject, injectable } from 'tsyringe'

import {
  AskarErrorCode,
  isAskarError,
  keyDerivationMethodToStoreKeyMethod,
  keyTypeSupportedByAskar,
  uriFromWalletConfig,
} from '../utils'

const isError = (error: unknown): error is Error => error instanceof Error

@injectable()
export class AskarWallet implements Wallet {
  private walletConfig?: WalletConfig
  private _session?: Session

  private _store?: Store

  private logger: Logger
  private fileSystem: FileSystem

  private keyProviderRegistry: KeyProviderRegistry

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    @inject(InjectionSymbols.FileSystem) fileSystem: FileSystem,
    keyProviderRegistry: KeyProviderRegistry
  ) {
    this.logger = logger
    this.fileSystem = fileSystem
    this.keyProviderRegistry = keyProviderRegistry
  }

  public get isProvisioned() {
    return this.walletConfig !== undefined
  }

  public get isInitialized() {
    return this._store !== undefined
  }

  public get store() {
    if (!this._store) {
      throw new AriesFrameworkError(
        'Wallet has not been initialized yet. Make sure to await agent.initialize() before using the agent.'
      )
    }

    return this._store
  }

  public get session() {
    if (!this._session) {
      throw new AriesFrameworkError('No Wallet Session is opened')
    }

    return this._session
  }

  /**
   * Dispose method is called when an agent context is disposed.
   */
  public async dispose() {
    if (this.isInitialized) {
      await this.close()
    }
  }

  /**
   * @throws {WalletDuplicateError} if the wallet already exists
   * @throws {WalletError} if another error occurs
   */
  public async create(walletConfig: WalletConfig): Promise<void> {
    await this.createAndOpen(walletConfig)
    await this.close()
  }

  /**
   * @throws {WalletDuplicateError} if the wallet already exists
   * @throws {WalletError} if another error occurs
   */
  public async createAndOpen(walletConfig: WalletConfig): Promise<void> {
    this.logger.debug(`Creating wallet '${walletConfig.id}`)

    const askarWalletConfig = await this.getAskarWalletConfig(walletConfig)

    // Check if database exists
    const { path: filePath } = uriFromWalletConfig(walletConfig, this.fileSystem.dataPath)
    if (filePath && (await this.fileSystem.exists(filePath))) {
      throw new WalletDuplicateError(`Wallet '${walletConfig.id}' already exists.`, {
        walletType: 'AskarWallet',
      })
    }
    try {
      this._store = await Store.provision({
        recreate: false,
        uri: askarWalletConfig.uri,
        profile: askarWalletConfig.profile,
        keyMethod: askarWalletConfig.keyMethod,
        passKey: askarWalletConfig.passKey,
      })
      this.walletConfig = walletConfig
      this._session = await this._store.openSession()
    } catch (error) {
      // FIXME: Askar should throw a Duplicate error code, but is currently returning Encryption
      // And if we provide the very same wallet key, it will open it without any error
      if (
        isAskarError(error) &&
        (error.code === AskarErrorCode.Encryption || error.code === AskarErrorCode.Duplicate)
      ) {
        const errorMessage = `Wallet '${walletConfig.id}' already exists`
        this.logger.debug(errorMessage)

        throw new WalletDuplicateError(errorMessage, {
          walletType: 'AskarWallet',
          cause: error,
        })
      }

      const errorMessage = `Error creating wallet '${walletConfig.id}'`
      this.logger.error(errorMessage, {
        error,
        errorMessage: error.message,
      })

      throw new WalletError(errorMessage, { cause: error })
    }

    this.logger.debug(`Successfully created wallet '${walletConfig.id}'`)
  }

  /**
   * @throws {WalletNotFoundError} if the wallet does not exist
   * @throws {WalletError} if another error occurs
   */
  public async open(walletConfig: WalletConfig): Promise<void> {
    await this._open(walletConfig)
  }

  /**
   * @throws {WalletNotFoundError} if the wallet does not exist
   * @throws {WalletError} if another error occurs
   */
  public async rotateKey(walletConfig: WalletConfigRekey): Promise<void> {
    if (!walletConfig.rekey) {
      throw new WalletError('Wallet rekey undefined!. Please specify the new wallet key')
    }
    await this._open(
      {
        id: walletConfig.id,
        key: walletConfig.key,
        keyDerivationMethod: walletConfig.keyDerivationMethod,
      },
      walletConfig.rekey,
      walletConfig.rekeyDerivationMethod
    )
  }

  /**
   * @throws {WalletNotFoundError} if the wallet does not exist
   * @throws {WalletError} if another error occurs
   */
  private async _open(
    walletConfig: WalletConfig,
    rekey?: string,
    rekeyDerivation?: KeyDerivationMethod
  ): Promise<void> {
    if (this._store) {
      throw new WalletError(
        'Wallet instance already opened. Close the currently opened wallet before re-opening the wallet'
      )
    }

    const askarWalletConfig = await this.getAskarWalletConfig(walletConfig)

    try {
      this._store = await Store.open({
        uri: askarWalletConfig.uri,
        keyMethod: askarWalletConfig.keyMethod,
        passKey: askarWalletConfig.passKey,
      })

      if (rekey) {
        await this._store.rekey({
          passKey: rekey,
          keyMethod: keyDerivationMethodToStoreKeyMethod(rekeyDerivation ?? KeyDerivationMethod.Argon2IMod),
        })
      }
      this._session = await this._store.openSession()

      this.walletConfig = walletConfig
    } catch (error) {
      if (isAskarError(error) && error.code === AskarErrorCode.NotFound) {
        const errorMessage = `Wallet '${walletConfig.id}' not found`
        this.logger.debug(errorMessage)

        throw new WalletNotFoundError(errorMessage, {
          walletType: 'AskarWallet',
          cause: error,
        })
      } else if (isAskarError(error) && error.code === AskarErrorCode.Encryption) {
        const errorMessage = `Incorrect key for wallet '${walletConfig.id}'`
        this.logger.debug(errorMessage)
        throw new WalletInvalidKeyError(errorMessage, {
          walletType: 'AskarWallet',
          cause: error,
        })
      }
      throw new WalletError(`Error opening wallet ${walletConfig.id}: ${error.message}`, { cause: error })
    }

    this.logger.debug(`Wallet '${walletConfig.id}' opened with handle '${this._store.handle.handle}'`)
  }

  /**
   * @throws {WalletNotFoundError} if the wallet does not exist
   * @throws {WalletError} if another error occurs
   */
  public async delete(): Promise<void> {
    if (!this.walletConfig) {
      throw new WalletError(
        'Can not delete wallet that does not have wallet config set. Make sure to call create wallet before deleting the wallet'
      )
    }

    this.logger.info(`Deleting wallet '${this.walletConfig.id}'`)
    if (this._store) {
      await this.close()
    }

    try {
      const { uri } = uriFromWalletConfig(this.walletConfig, this.fileSystem.dataPath)
      await Store.remove(uri)
    } catch (error) {
      const errorMessage = `Error deleting wallet '${this.walletConfig.id}': ${error.message}`
      this.logger.error(errorMessage, {
        error,
        errorMessage: error.message,
      })

      throw new WalletError(errorMessage, { cause: error })
    }
  }

  public async export(exportConfig: WalletExportImportConfig) {
    if (!this.walletConfig) {
      throw new WalletError(
        'Can not export wallet that does not have wallet config set. Make sure to open it before exporting'
      )
    }

    const { path: destinationPath, key: exportKey } = exportConfig

    const { path: sourcePath } = uriFromWalletConfig(this.walletConfig, this.fileSystem.dataPath)
    if (!sourcePath) {
      throw new WalletError('Export is only supported for SQLite backend')
    }

    try {
      // This method ensures that destination directory is created
      const exportedWalletConfig = await this.getAskarWalletConfig({
        ...this.walletConfig,
        storage: { type: 'sqlite', path: destinationPath },
      })

      // Close this wallet before copying
      await this.close()

      // Export path already exists
      if (await this.fileSystem.exists(destinationPath)) {
        throw new WalletExportPathExistsError(
          `Unable to create export, wallet export at path '${exportConfig.path}' already exists`
        )
      }

      // Copy wallet to the destination path
      await this.fileSystem.copyFile(sourcePath, destinationPath)

      // Open exported wallet and rotate its key to the one requested
      const exportedWalletStore = await Store.open({
        uri: exportedWalletConfig.uri,
        keyMethod: exportedWalletConfig.keyMethod,
        passKey: exportedWalletConfig.passKey,
      })
      await exportedWalletStore.rekey({ keyMethod: exportedWalletConfig.keyMethod, passKey: exportKey })

      await exportedWalletStore.close()

      await this._open(this.walletConfig)
    } catch (error) {
      if (error instanceof WalletExportPathExistsError) throw error

      const errorMessage = `Error exporting wallet '${this.walletConfig.id}': ${error.message}`
      this.logger.error(errorMessage, {
        error,
        errorMessage: error.message,
      })

      throw new WalletError(errorMessage, { cause: error })
    }
  }

  public async import(walletConfig: WalletConfig, importConfig: WalletExportImportConfig) {
    const { path: sourcePath, key: importKey } = importConfig
    const { path: destinationPath } = uriFromWalletConfig(walletConfig, this.fileSystem.dataPath)

    if (!destinationPath) {
      throw new WalletError('Import is only supported for SQLite backend')
    }

    try {
      // This method ensures that destination directory is created
      const importWalletConfig = await this.getAskarWalletConfig(walletConfig)

      // Copy wallet to the destination path
      await this.fileSystem.copyFile(sourcePath, destinationPath)

      // Open imported wallet and rotate its key to the one requested
      const importedWalletStore = await Store.open({
        uri: importWalletConfig.uri,
        keyMethod: importWalletConfig.keyMethod,
        passKey: importKey,
      })

      await importedWalletStore.rekey({
        keyMethod: importWalletConfig.keyMethod,
        passKey: importWalletConfig.passKey,
      })

      await importedWalletStore.close()
    } catch (error) {
      const errorMessage = `Error importing wallet '${walletConfig.id}': ${error.message}`
      this.logger.error(errorMessage, {
        error,
        errorMessage: error.message,
      })

      throw new WalletError(errorMessage, { cause: error })
    }
  }

  /**
   * @throws {WalletError} if the wallet is already closed or another error occurs
   */
  public async close(): Promise<void> {
    this.logger.debug(`Closing wallet ${this.walletConfig?.id}`)
    if (!this._store) {
      throw new WalletError('Wallet is in invalid state, you are trying to close wallet that has no handle.')
    }

    try {
      await this.session.close()
      await this.store.close()
      this._session = undefined
      this._store = undefined
    } catch (error) {
      const errorMessage = `Error closing wallet': ${error.message}`
      this.logger.error(errorMessage, {
        error,
        errorMessage: error.message,
      })

      throw new WalletError(errorMessage, { cause: error })
    }
  }

  /**
   * Create a key with an optional seed and keyType.
   * The keypair is also automatically stored in the wallet afterwards
   */
  public async createKey({ seed, privateKey, keyType }: WalletCreateKeyOptions): Promise<Key> {
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

      if (keyTypeSupportedByAskar(keyType)) {
        const algorithm = keyAlgFromString(keyType)

        // Create key
        let key: AskarKey | undefined
        try {
          const key = privateKey
            ? AskarKey.fromSecretBytes({ secretKey: privateKey, algorithm })
            : seed
            ? AskarKey.fromSeed({ seed, algorithm })
            : AskarKey.generate(algorithm)

          const keyPublicBytes = key.publicBytes
          // Store key
          await this.session.insertKey({ key, name: TypedArrayEncoder.toBase58(keyPublicBytes) })
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
      } else {
        // Check if there is a signing key provider for the specified key type.
        if (this.keyProviderRegistry.hasProviderForKeyType(keyType)) {
          const signingKeyProvider = this.keyProviderRegistry.getProviderForKeyType(keyType)

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
        throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error', { cause: error })
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
    let keyEntry: KeyEntryObject | null | undefined
    try {
      if (keyTypeSupportedByAskar(key.keyType)) {
        if (!TypedArrayEncoder.isTypedArray(data)) {
          throw new WalletError(`Currently not supporting signing of multiple messages`)
        }
        keyEntry = await this.session.fetchKey({ name: key.publicKeyBase58 })

        if (!keyEntry) {
          throw new WalletError('Key entry not found')
        }

        const signed = keyEntry.key.signMessage({ message: data as Buffer })

        keyEntry.key.handle.free()

        return Buffer.from(signed)
      } else {
        // Check if there is a signing key provider for the specified key type.
        if (this.keyProviderRegistry.hasProviderForKeyType(key.keyType)) {
          const signingKeyProvider = this.keyProviderRegistry.getProviderForKeyType(key.keyType)

          const keyPair = await this.retrieveKeyPair(key.publicKeyBase58)
          const signed = await signingKeyProvider.sign({
            data,
            privateKeyBase58: keyPair.privateKeyBase58,
            publicKeyBase58: key.publicKeyBase58,
          })

          return signed
        }
        throw new WalletError(`Unsupported keyType: ${key.keyType}`)
      }
    } catch (error) {
      keyEntry?.key.handle.free()
      if (!isError(error)) {
        throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error', { cause: error })
      }
      throw new WalletError(`Error signing data with verkey ${key.publicKeyBase58}. ${error.message}`, { cause: error })
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
      if (keyTypeSupportedByAskar(key.keyType)) {
        if (!TypedArrayEncoder.isTypedArray(data)) {
          throw new WalletError(`Currently not supporting verification of multiple messages`)
        }

        const askarKey = AskarKey.fromPublicBytes({
          algorithm: keyAlgFromString(key.keyType),
          publicKey: key.publicKey,
        })
        const verified = askarKey.verifySignature({ message: data as Buffer, signature })
        askarKey.handle.free()
        return verified
      } else {
        // Check if there is a signing key provider for the specified key type.
        if (this.keyProviderRegistry.hasProviderForKeyType(key.keyType)) {
          const signingKeyProvider = this.keyProviderRegistry.getProviderForKeyType(key.keyType)

          const signed = await signingKeyProvider.verify({
            data,
            signature,
            publicKeyBase58: key.publicKeyBase58,
          })

          return signed
        }
        throw new WalletError(`Unsupported keyType: ${key.keyType}`)
      }
    } catch (error) {
      askarKey?.handle.free()
      if (!isError(error)) {
        throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error', { cause: error })
      }
      throw new WalletError(`Error verifying signature of data signed with verkey ${key.publicKeyBase58}`, {
        cause: error,
      })
    }
  }

  /**
   * Pack a message using DIDComm V1 or DIDComm V2 encryption algorithms
   *
   * @param payload message to send
   * @param params packing options specific for envelop version
   * @returns JWE Envelope to send
   */
  public async pack(payload: Record<string, unknown>, params: WalletPackOptions): Promise<EncryptedMessage> {
    if (params.didCommVersion === DidCommMessageVersion.V1) {
      return this.packDidCommV1(payload, params)
    }
    if (params.didCommVersion === DidCommMessageVersion.V2) {
      return this.packDidCommV2(payload, params)
    }
    throw new AriesFrameworkError(`Unsupported DidComm version: ${params.didCommVersion}`)
  }

  /**
   * Pack a message using DIDComm V1 encryption algorithms
   *
   * @param payload message to send
   * @param params packing options specific for envelop version
   * @returns JWE Envelope to send
   */
  private async packDidCommV1(payload: Record<string, unknown>, params: WalletPackOptions): Promise<EncryptedMessage> {
    const { senderKey: senderVerkey, recipientKeys } = params

    let cek: AskarKey | undefined
    let senderKey: KeyEntryObject | null | undefined
    let senderExchangeKey: AskarKey | undefined

    try {
      cek = AskarKey.generate(KeyAlgs.Chacha20C20P)

      const senderKid = senderVerkey?.publicKeyBase58
      senderKey = senderKid ? await this.session.fetchKey({ name: senderKid }) : undefined
      if (senderVerkey && !senderKey) {
        throw new WalletError(`Unable to pack message. Sender key ${senderVerkey} not found in wallet.`)
      }

      senderExchangeKey = senderKey ? senderKey.key.convertkey({ algorithm: KeyAlgs.X25519 }) : undefined

      const recipients: JweRecipient[] = []

      for (const recipientKey of recipientKeys) {
        const recipientKid = recipientKey.publicKeyBase58
        let targetExchangeKey: AskarKey | undefined
        try {
          targetExchangeKey = AskarKey.fromPublicBytes({
            publicKey: Key.fromPublicKeyBase58(recipientKid, KeyType.Ed25519).publicKey,
            algorithm: KeyAlgs.Ed25519,
          }).convertkey({ algorithm: KeyAlgs.X25519 })

          if (senderVerkey && senderExchangeKey && senderKid) {
            const encryptedSender = CryptoBox.seal({
              recipientKey: targetExchangeKey,
              message: Buffer.from(senderKid),
            })
            const nonce = CryptoBox.randomNonce()
            const encryptedCek = CryptoBox.cryptoBox({
              recipientKey: targetExchangeKey,
              senderKey: senderExchangeKey,
              message: cek.secretBytes,
              nonce,
            })

            recipients.push(
              new JweRecipient({
                encryptedKey: encryptedCek,
                header: {
                  kid: recipientKid,
                  sender: TypedArrayEncoder.toBase64URL(encryptedSender),
                  iv: TypedArrayEncoder.toBase64URL(nonce),
                },
              })
            )
          } else {
            const encryptedCek = CryptoBox.seal({
              recipientKey: targetExchangeKey,
              message: cek.secretBytes,
            })
            recipients.push(
              new JweRecipient({
                encryptedKey: encryptedCek,
                header: {
                  kid: recipientKid,
                },
              })
            )
          }
        } finally {
          targetExchangeKey?.handle.free()
        }
      }

      const protectedJson = {
        enc: 'xchacha20poly1305_ietf',
        typ: 'JWM/1.0',
        alg: senderVerkey ? 'Authcrypt' : 'Anoncrypt',
        recipients: recipients.map((item) => JsonTransformer.toJSON(item)),
      }

      const { ciphertext, tag, nonce } = cek.aeadEncrypt({
        message: Buffer.from(JSON.stringify(payload)),
        aad: Buffer.from(JsonEncoder.toBase64URL(protectedJson)),
      }).parts

      const envelope = new JweEnvelope({
        ciphertext: TypedArrayEncoder.toBase64URL(ciphertext),
        iv: TypedArrayEncoder.toBase64URL(nonce),
        protected: JsonEncoder.toBase64URL(protectedJson),
        tag: TypedArrayEncoder.toBase64URL(tag),
      }).toJson()

      return envelope as EncryptedMessage
    } finally {
      cek?.handle.free()
      senderKey?.key.handle.free()
      senderExchangeKey?.handle.free()
    }
  }

  /**
   * Pack a message using DIDComm V2 encryption algorithms
   *
   * @param payload message to send
   * @param params packing options specific for envelop version
   * @returns JWE Envelope to send
   */
  private async packDidCommV2(payload: Record<string, unknown>, params: WalletPackOptions): Promise<EncryptedMessage> {
    if (params.senderKey) {
      return this.encryptEcdh1Pu(payload, params.senderKey, params.recipientKeys)
    } else {
      return this.encryptEcdhEs(payload, params.recipientKeys)
    }
  }

  private async encryptEcdhEs(payload: Record<string, unknown>, recipientKeys: Key[]): Promise<EncryptedMessage> {
    const wrapId = DidCommV2KeyProtectionAlgs.EcdhEsA256Kw
    const wrapAlg = KeyAlgs.AesA256Kw
    const encId = DidCommV2EncryptionAlgs.XC20P
    const encAlg = KeyAlgs.Chacha20XC20P
    const keyAlg = KeyAlgs.X25519

    let recipientX25519Key: AskarKey | undefined
    let cek: AskarKey | undefined
    let epk: AskarKey | undefined

    try {
      // Generated once for all recipients
      // https://identity.foundation/didcomm-messaging/spec/#ecdh-es-key-wrapping-and-common-protected-headers
      epk = AskarKey.generate(keyAlg, true)

      const jweBuilder = new JweEnvelopeBuilder({
        typ: DidCommV2Types.EncryptedJson,
        enc: encId,
        alg: wrapId,
      })
        .setEpk(JsonEncoder.toString(epk.jwkPublic))
        .setApv([...recipientKeys].map((recipientKey) => recipientKey.fingerprint))

      // As per spec we firstly need to encrypt the payload and then use tag as part of the key derivation process
      // https://identity.foundation/didcomm-messaging/spec/#ecdh-es-key-wrapping-and-common-protected-headers
      cek = AskarKey.generate(encAlg)

      const { ciphertext, tag, nonce } = cek.aeadEncrypt({
        message: Buffer.from(JSON.stringify(payload)),
        aad: jweBuilder.aad(),
      }).parts

      for (const recipientKey of recipientKeys) {
        try {
          recipientX25519Key = AskarKey.fromPublicBytes({
            publicKey: recipientKey.publicKey,
            algorithm: keyAlg,
          })

          // According to the spec `kid` MUST be a DID URI
          // https://identity.foundation/didcomm-messaging/spec/#construction
          const recipientDidKey = new DidKey(recipientKey).did
          const recipientKid = `${recipientDidKey}#${recipientKey.fingerprint}`

          // Wrap the recipient key using ECDH-ES
          // FIXME: according to the spec `tag` must be used for the wrapping but there is not such parameter
          // https://identity.foundation/didcomm-messaging/spec/#ecdh-es-key-wrapping-and-common-protected-headers
          const encryptedKey = new EcdhEs({
            algId: jweBuilder.alg(),
            apu: jweBuilder.apu(),
            apv: jweBuilder.apv(),
          }).senderWrapKey({
            wrapAlg,
            ephemeralKey: epk,
            recipientKey: recipientX25519Key,
            cek,
          }).ciphertext

          jweBuilder.setRecipient(
            new JweRecipient({
              encryptedKey,
              header: {
                kid: recipientKid,
              },
            })
          )
        } finally {
          recipientX25519Key?.handle.free()
        }
      }

      const jwe = jweBuilder.setCiphertext(ciphertext).setIv(nonce).setTag(tag).finalize()
      return jwe.toJson() as EncryptedMessage
    } finally {
      epk?.handle.free()
      cek?.handle.free()
    }
  }

  private async encryptEcdh1Pu(
    payload: Record<string, unknown>,
    senderKey: Key,
    recipientKeys: Key[]
  ): Promise<EncryptedMessage> {
    const wrapAlg = KeyAlgs.AesA256Kw
    const encAlg = KeyAlgs.AesA256CbcHs512
    const keyAlg = keyAlgFromString(senderKey.keyType)

    let senderAskarKey: KeyEntryObject | undefined | null
    let recipientAskarKey: AskarKey | undefined
    let cek: AskarKey | undefined
    let epk: AskarKey | undefined

    try {
      // currently, keys are stored in the wallet by their base58 representation
      senderAskarKey = await this.session.fetchKey({ name: senderKey.publicKeyBase58 })
      if (!senderAskarKey) {
        throw new WalletError(`Unable to pack message. Sender key ${senderKey} not found in wallet.`)
      }

      // According to the spec `skid` MUST be a DID URI
      const senderDidKey = new DidKey(senderKey).did
      const senderKid = `${senderDidKey}#${senderKey.fingerprint}`

      // Generated once for all recipients
      // https://identity.foundation/didcomm-messaging/spec/#ecdh-1pu-key-wrapping-and-common-protected-headers
      epk = AskarKey.generate(keyAlg, true)

      const jweBuilder = new JweEnvelopeBuilder({
        typ: DidCommV2Types.EncryptedJson,
        enc: DidCommV2EncryptionAlgs.A256CbcHs512,
        alg: DidCommV2KeyProtectionAlgs.Ecdh1PuA256Kw,
      })
        .setSkid(senderKid)
        .setEpk(JsonEncoder.toString(epk.jwkPublic))
        .setApu(senderKid)
        .setApv([...recipientKeys].map((recipientKey) => recipientKey.fingerprint))

      // As per spec we firstly need to encrypt the payload and then use tag as part of the key derivation process
      // https://identity.foundation/didcomm-messaging/spec/#ecdh-1pu-key-wrapping-and-common-protected-headers
      cek = AskarKey.generate(encAlg)

      const message = Buffer.from(JSON.stringify(payload))
      const { ciphertext, tag, nonce } = cek.aeadEncrypt({
        message,
        aad: jweBuilder.aad(),
      }).parts

      for (const recipientKey of recipientKeys) {
        try {
          recipientAskarKey = AskarKey.fromPublicBytes({
            publicKey: recipientKey.publicKey,
            algorithm: keyAlg,
          })

          // According to the spec `kid` MUST be a DID URI
          // https://identity.foundation/didcomm-messaging/spec/#construction
          const recipientDidKey = new DidKey(recipientKey).did
          const recipientKid = `${recipientDidKey}#${recipientKey.fingerprint}`

          // Wrap the recipient key using ECDH-1PU
          const encryptedCek = new Ecdh1PU({
            algId: jweBuilder.alg(),
            apv: jweBuilder.apv(),
            apu: jweBuilder.apu(),
          }).senderWrapKey({
            wrapAlg,
            cek,
            ephemeralKey: epk,
            ccTag: tag,
            senderKey: senderAskarKey.key,
            recipientKey: recipientAskarKey,
          }).ciphertext

          jweBuilder.setRecipient(
            new JweRecipient({
              encryptedKey: encryptedCek,
              header: {
                kid: recipientKid,
              },
            })
          )
        } finally {
          recipientAskarKey?.handle.free()
        }
      }

      const jwe = jweBuilder.setCiphertext(ciphertext).setIv(nonce).setTag(tag).finalize()
      return jwe.toJson() as EncryptedMessage
    } finally {
      epk?.handle.free()
      cek?.handle.free()
      senderAskarKey?.key.handle.free()
    }
  }

  /**
   * Unpacks a JWE Envelope coded using DIDComm V1 of DIDComm V2 encryption algorithms
   *
   * @param messagePackage JWE Envelope
   *
   * @returns UnpackedMessageContext with plain text message, sender key, recipient key, and didcomm message version
   */
  public async unpack(messagePackage: EncryptedMessage): Promise<UnpackedMessageContext> {
    if (isDidCommV1EncryptedEnvelope(messagePackage)) {
      return this.unpackDidCommV1(messagePackage)
    } else {
      return this.unpackDidCommV2(messagePackage)
    }
  }

  /**
   * Unpacks a JWE Envelope coded using DIDComm V1 encryption algorithms
   *
   * @param messagePackage JWE Envelope
   *
   * @returns UnpackedMessageContext with plain text message, sender key, recipient key, and didcomm message version
   */
  private async unpackDidCommV1(messagePackage: EncryptedMessage): Promise<UnpackedMessageContext> {
    // Decode a message using DIDComm v1 encryption.
    const protected_ = JsonEncoder.fromBase64(messagePackage.protected)

    const recipients = []

    for (const recip of protected_.recipients) {
      const kid = recip.header.kid
      if (!kid) {
        throw new WalletError('Blank recipient key')
      }
      const sender = recip.header.sender ? TypedArrayEncoder.fromBase64(recip.header.sender) : undefined
      const iv = recip.header.iv ? TypedArrayEncoder.fromBase64(recip.header.iv) : undefined
      if (sender && !iv) {
        throw new WalletError('Missing IV')
      } else if (!sender && iv) {
        throw new WalletError('Unexpected IV')
      }
      recipients.push({
        kid,
        sender,
        iv,
        encrypted_key: TypedArrayEncoder.fromBase64(recip.encrypted_key),
      })
    }

    let payloadKey, senderKey, recipientKey

    for (const recipient of recipients) {
      let recipientKeyEntry: KeyEntryObject | null | undefined
      let sender_x: AskarKey | undefined
      let recip_x: AskarKey | undefined

      try {
        recipientKeyEntry = await this.session.fetchKey({ name: recipient.kid })
        if (recipientKeyEntry) {
          const recip_x = recipientKeyEntry.key.convertkey({ algorithm: KeyAlgs.X25519 })
          recipientKey = recipient.kid

          if (recipient.sender && recipient.iv) {
            senderKey = TypedArrayEncoder.toUtf8String(
              CryptoBox.sealOpen({
                recipientKey: recip_x,
                ciphertext: recipient.sender,
              })
            )
            const sender_x = AskarKey.fromPublicBytes({
              algorithm: KeyAlgs.Ed25519,
              publicKey: TypedArrayEncoder.fromBase58(senderKey),
            }).convertkey({ algorithm: KeyAlgs.X25519 })

            payloadKey = CryptoBox.open({
              recipientKey: recip_x,
              senderKey: sender_x,
              message: recipient.encrypted_key,
              nonce: recipient.iv,
            })
          } else {
            payloadKey = CryptoBox.sealOpen({ ciphertext: recipient.encrypted_key, recipientKey: recip_x })
          }
          break
        }
      } finally {
        recipientKeyEntry?.key.handle.free()
        sender_x?.handle.free()
        recip_x?.handle.free()
      }
    }
    if (!payloadKey) {
      throw new WalletError('No corresponding recipient key found')
    }

    if (!senderKey && protected_.alg === 'Authcrypt') {
      throw new WalletError('Sender public key not provided for Authcrypt')
    }

    let cek: AskarKey | undefined
    try {
      cek = AskarKey.fromSecretBytes({ algorithm: KeyAlgs.Chacha20C20P, secretKey: payloadKey })
      const message = cek.aeadDecrypt({
        ciphertext: TypedArrayEncoder.fromBase64(messagePackage.ciphertext as any),
        nonce: TypedArrayEncoder.fromBase64(messagePackage.iv as any),
        tag: TypedArrayEncoder.fromBase64(messagePackage.tag as any),
        aad: TypedArrayEncoder.fromString(messagePackage.protected),
      })
      return {
        didCommVersion: DidCommMessageVersion.V1,
        plaintextMessage: JsonEncoder.fromBuffer(message),
        recipientKey,
        senderKey: senderKey ? Key.fromPublicKeyBase58(senderKey, KeyType.Ed25519) : undefined,
      }
    } finally {
      cek?.handle.free()
    }
  }

  /**
   * Unpacks a JWE Envelope coded using DIDComm V2 encryption algorithms
   *
   * @param messagePackage JWE Envelope
   *
   * @returns UnpackedMessageContext with plain text message, sender key, recipient key, and didcomm message version
   */
  private async unpackDidCommV2(messagePackage: EncryptedMessage): Promise<UnpackedMessageContext> {
    const protected_ = JsonEncoder.fromBase64(messagePackage.protected)
    if (
      protected_.alg === DidCommV2KeyProtectionAlgs.EcdhEsA128Kw ||
      protected_.alg === DidCommV2KeyProtectionAlgs.EcdhEsA256Kw
    ) {
      return this.decryptEcdhEs(messagePackage, protected_)
    }
    if (
      protected_.alg === DidCommV2KeyProtectionAlgs.Ecdh1PuA128Kw ||
      protected_.alg === DidCommV2KeyProtectionAlgs.Ecdh1PuA256Kw
    ) {
      return this.decryptEcdh1Pu(messagePackage, protected_)
    }
    throw new AriesFrameworkError(`Unsupported JWE algorithm: ${protected_.alg}`)
  }

  private async decryptEcdhEs(jwe: EncryptedMessage, protected_: any): Promise<UnpackedMessageContext> {
    const { alg, apu, apv, enc } = protected_
    const wrapAlg = alg.slice(8)

    if (![DidCommV2KeyProtectionAlgs.EcdhEsA128Kw, DidCommV2KeyProtectionAlgs.EcdhEsA256Kw].includes(alg)) {
      throw new AriesFrameworkError(`Unsupported ECDH-ES algorithm: ${alg}`)
    }
    if (!['A128GCM', 'A256GCM', 'A128CBC-HS256', 'A256CBC-HS512', 'XC20P'].includes(enc)) {
      throw new AriesFrameworkError(`Unsupported ECDH-ES content encryption: ${alg}`)
    }

    let recipientAskarKey: KeyEntryObject | null | undefined
    let cek: AskarKey | undefined
    let epk: AskarKey | undefined

    try {
      // Generated once for all recipients
      // https://identity.foundation/didcomm-messaging/spec/#ecdh-es-key-wrapping-and-common-protected-headers
      epk = AskarKey.fromJwk({ jwk: Jwk.fromString(protected_.epk) })

      for (const recipient of jwe.recipients) {
        try {
          // currently, keys are stored in the wallet by their base58 representation
          const recipientKey = Key.fromPublicKeyId(recipient.header.kid)
          recipientAskarKey = await this.session.fetchKey({ name: recipientKey.publicKeyBase58 })
          if (!recipientAskarKey) continue

          // unwrap the key using ECDH-ES
          cek = new EcdhEs({
            algId: Uint8Array.from(Buffer.from(alg)),
            apv: Uint8Array.from(Buffer.from(apv ?? [])),
            apu: Uint8Array.from(Buffer.from(apu ?? [])),
          }).receiverUnwrapKey({
            wrapAlg,
            encAlg: enc,
            ephemeralKey: epk,
            recipientKey: recipientAskarKey.key,
            ciphertext: TypedArrayEncoder.fromBase64(recipient.encrypted_key),
            // tag: TypedArrayEncoder.fromBase64(jwe.tag),
          })

          // decrypt the message using the key
          const plaintext = cek.aeadDecrypt({
            ciphertext: TypedArrayEncoder.fromBase64(jwe.ciphertext),
            nonce: TypedArrayEncoder.fromBase64(jwe.iv),
            tag: TypedArrayEncoder.fromBase64(jwe.tag),
            aad: TypedArrayEncoder.fromString(jwe.protected),
          })

          return {
            didCommVersion: DidCommMessageVersion.V2,
            plaintextMessage: JsonEncoder.fromBuffer(plaintext),
            recipientKey,
          }
        } finally {
          recipientAskarKey?.key.handle.free()
          cek?.handle.free()
        }
      }
    } finally {
      epk?.handle.free()
    }

    throw new AriesFrameworkError('Unable to decrypt message')
  }

  private async decryptEcdh1Pu(jwe: EncryptedMessage, protected_: any): Promise<UnpackedMessageContext> {
    const { alg, enc, apu, apv, skid } = protected_
    const wrapAlg = alg.slice(9)

    if (![DidCommV2KeyProtectionAlgs.Ecdh1PuA128Kw, DidCommV2KeyProtectionAlgs.Ecdh1PuA256Kw].includes(alg)) {
      throw new AriesFrameworkError(`Unsupported ECDH-1PU algorithm: ${alg}`)
    }
    if (!['A128CBC-HS256', 'A256CBC-HS512'].includes(enc)) {
      throw new AriesFrameworkError(`Unsupported ECDH-1PU content encryption: ${alg}`)
    }

    let recipientAskarKey: KeyEntryObject | null | undefined
    let senderAskarKey: AskarKey | undefined
    let cek: AskarKey | undefined
    let epk: AskarKey | undefined

    try {
      // Validate the `apu` filed is similar to `skid`
      // https://identity.foundation/didcomm-messaging/spec/#ecdh-1pu-key-wrapping-and-common-protected-headers
      const senderKidApu = TypedArrayEncoder.fromBase64(apu).toString('utf-8')
      if (senderKidApu && skid && senderKidApu !== skid) {
        throw new AriesFrameworkError('Mismatch between skid and apu')
      }
      const senderKid = skid ?? senderKidApu
      if (!senderKid) {
        throw new AriesFrameworkError('Sender key ID not provided')
      }

      // FIXME: Properly, we need to properly resolve sender key doing the following steps:
      //  1. Extract a DID from DID URL
      //  2. Resolve DID Doc for sender
      //  3. Get matching the ID
      // So it looks like we need to use DidResolver inside of the wallet
      const senderKey = Key.fromPublicKeyId(senderKid)
      senderAskarKey = AskarKey.fromPublicBytes({
        publicKey: senderKey.publicKey,
        algorithm: keyAlgFromString(senderKey.keyType),
      })

      // Generated once for all recipients
      epk = AskarKey.fromJwk({ jwk: Jwk.fromString(protected_.epk) })

      for (const recipient of jwe.recipients) {
        try {
          // currently, keys are stored in the wallet by their base58 representation
          const recipientKey = Key.fromPublicKeyId(recipient.header.kid)
          recipientAskarKey = await this.session.fetchKey({ name: recipientKey.publicKeyBase58 })
          if (!recipientAskarKey) continue

          // unwrap the key using ECDH-1PU
          cek = new Ecdh1PU({
            apv: Uint8Array.from(Buffer.from(apv)),
            apu: Uint8Array.from(Buffer.from(apu)),
            algId: Uint8Array.from(Buffer.from(alg)),
          }).receiverUnwrapKey({
            wrapAlg: wrapAlg,
            encAlg: enc,
            ephemeralKey: epk,
            senderKey: senderAskarKey,
            recipientKey: recipientAskarKey.key,
            ccTag: TypedArrayEncoder.fromBase64(jwe.tag),
            ciphertext: TypedArrayEncoder.fromBase64(recipient.encrypted_key),
          })

          // decrypt the message using the key
          const plaintext = cek.aeadDecrypt({
            ciphertext: TypedArrayEncoder.fromBase64(jwe.ciphertext),
            nonce: TypedArrayEncoder.fromBase64(jwe.iv),
            tag: TypedArrayEncoder.fromBase64(jwe.tag),
            aad: TypedArrayEncoder.fromString(jwe.protected),
          })

          return {
            didCommVersion: DidCommMessageVersion.V2,
            plaintextMessage: JsonEncoder.fromBuffer(plaintext),
            senderKey,
            recipientKey,
          }
        } finally {
          cek?.handle.free()
          recipientAskarKey?.key?.handle.free()
        }
      }
    } finally {
      senderAskarKey?.handle.free()
      epk?.handle.free()
    }
    throw new AriesFrameworkError('Unable to decrypt didcomm v2 envelop')
  }

  public async generateNonce(): Promise<string> {
    try {
      // generate an 80-bit nonce suitable for AnonCreds proofs
      const nonce = CryptoBox.randomNonce().slice(0, 10)
      return new BigNumber(nonce).toString()
    } catch (error) {
      if (!isError(error)) {
        throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error', { cause: error })
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

  private async getAskarWalletConfig(walletConfig: WalletConfig) {
    const { uri, path } = uriFromWalletConfig(walletConfig, this.fileSystem.dataPath)

    // Make sure path exists before creating the wallet
    if (path) {
      await this.fileSystem.createDirectory(path)
    }

    return {
      uri,
      profile: walletConfig.id,
      // FIXME: Default derivation method should be set somewhere in either agent config or some constants
      keyMethod: keyDerivationMethodToStoreKeyMethod(
        walletConfig.keyDerivationMethod ?? KeyDerivationMethod.Argon2IMod
      ),
      passKey: walletConfig.key,
    }
  }

  private async retrieveKeyPair(publicKeyBase58: string): Promise<KeyPair> {
    try {
      const entryObject = await this.session.fetch({ category: 'KeyPairRecord', name: `key-${publicKeyBase58}` })

      if (entryObject?.value) {
        return JsonEncoder.fromString(entryObject?.value as string) as KeyPair
      } else {
        throw new WalletError(`No content found for record with public key: ${publicKeyBase58}`)
      }
    } catch (error) {
      throw new WalletError('Error retrieving KeyPair record', { cause: error })
    }
  }

  private async storeKeyPair(keyPair: KeyPair): Promise<void> {
    try {
      await this.session.insert({
        category: 'KeyPairRecord',
        name: `key-${keyPair.publicKeyBase58}`,
        value: JSON.stringify(keyPair),
        tags: {
          keyType: keyPair.keyType,
        },
      })
    } catch (error) {
      if (isAskarError(error, AskarErrorCode.Duplicate)) {
        throw new WalletKeyExistsError('Key already exists')
      }
      throw new WalletError('Error saving KeyPair record', { cause: error })
    }
  }
}
