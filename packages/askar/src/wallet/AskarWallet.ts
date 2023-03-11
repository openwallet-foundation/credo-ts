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
  KeyDerivationMethod,
  WalletExportImportConfig,
} from '@aries-framework/core'
import type { KeyEntryObject, Session } from '@hyperledger/aries-askar-shared'

import {
  WalletKeyExistsError,
  isValidSeed,
  isValidPrivateKey,
  JsonTransformer,
  WalletInvalidKeyError,
  WalletDuplicateError,
  JsonEncoder,
  KeyType,
  Buffer,
  AriesFrameworkError,
  Logger,
  WalletError,
  InjectionSymbols,
  Key,
  SigningProviderRegistry,
  TypedArrayEncoder,
  FileSystem,
  WalletNotFoundError,
} from '@aries-framework/core'
import {
  StoreKeyMethod,
  KeyAlgs,
  CryptoBox,
  Store,
  Key as AskarKey,
  keyAlgFromString,
} from '@hyperledger/aries-askar-shared'
// eslint-disable-next-line import/order
import BigNumber from 'bn.js'

const isError = (error: unknown): error is Error => error instanceof Error

import { inject, injectable } from 'tsyringe'

import {
  AskarErrorCode,
  isAskarError,
  keyDerivationMethodToStoreKeyMethod,
  keyTypeSupportedByAskar,
  uriFromWalletConfig,
} from '../utils'

import { JweEnvelope, JweRecipient } from './JweEnvelope'

@injectable()
export class AskarWallet implements Wallet {
  private walletConfig?: WalletConfig
  private _session?: Session

  private _store?: Store

  private logger: Logger
  private fileSystem: FileSystem

  private signingKeyProviderRegistry: SigningProviderRegistry

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    @inject(InjectionSymbols.FileSystem) fileSystem: FileSystem,
    signingKeyProviderRegistry: SigningProviderRegistry
  ) {
    this.logger = logger
    this.fileSystem = fileSystem
    this.signingKeyProviderRegistry = signingKeyProviderRegistry
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
          keyMethod:
            keyDerivationMethodToStoreKeyMethod(rekeyDerivation) ??
            (`${StoreKeyMethod.Kdf}:argon2i:int` as StoreKeyMethod),
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

      await importedWalletStore.rekey({ keyMethod: importWalletConfig.keyMethod, passKey: importWalletConfig.passKey })

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
        if (this.signingKeyProviderRegistry.hasProviderForKeyType(key.keyType)) {
          const signingKeyProvider = this.signingKeyProviderRegistry.getProviderForKeyType(key.keyType)

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
      throw new WalletError(`Error signing data with verkey ${key.publicKeyBase58}`, { cause: error })
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
        if (this.signingKeyProviderRegistry.hasProviderForKeyType(key.keyType)) {
          const signingKeyProvider = this.signingKeyProviderRegistry.getProviderForKeyType(key.keyType)

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
    let cek: AskarKey | undefined
    let senderKey: KeyEntryObject | null | undefined
    let senderExchangeKey: AskarKey | undefined

    try {
      cek = AskarKey.generate(KeyAlgs.Chacha20C20P)
      senderKey = senderVerkey ? await this.session.fetchKey({ name: senderVerkey }) : undefined
      senderExchangeKey = senderKey ? senderKey.key.convertkey({ algorithm: KeyAlgs.X25519 }) : undefined

      const recipients: JweRecipient[] = []

      for (const recipientKey of recipientKeys) {
        let targetExchangeKey: AskarKey | undefined
        try {
          targetExchangeKey = AskarKey.fromPublicBytes({
            publicKey: Key.fromPublicKeyBase58(recipientKey, KeyType.Ed25519).publicKey,
            algorithm: KeyAlgs.Ed25519,
          }).convertkey({ algorithm: KeyAlgs.X25519 })

          if (senderVerkey && senderExchangeKey) {
            const encryptedSender = CryptoBox.seal({
              recipientKey: targetExchangeKey,
              message: Buffer.from(senderVerkey),
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
                  kid: recipientKey,
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
                  kid: recipientKey,
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
   * Unpacks a JWE Envelope coded using DIDComm V1 algorithm
   *
   * @param messagePackage JWE Envelope
   * @returns UnpackedMessageContext with plain text message, sender key and recipient key
   */
  public async unpack(messagePackage: EncryptedMessage): Promise<UnpackedMessageContext> {
    const protectedJson = JsonEncoder.fromBase64(messagePackage.protected)

    const alg = protectedJson.alg
    if (!['Anoncrypt', 'Authcrypt'].includes(alg)) {
      throw new WalletError(`Unsupported pack algorithm: ${alg}`)
    }

    const recipients = []

    for (const recip of protectedJson.recipients) {
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

    if (!senderKey && alg === 'Authcrypt') {
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
        plaintextMessage: JsonEncoder.fromBuffer(message),
        senderKey,
        recipientKey,
      }
    } finally {
      cek?.handle.free()
    }
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
      keyMethod:
        keyDerivationMethodToStoreKeyMethod(walletConfig.keyDerivationMethod) ??
        (`${StoreKeyMethod.Kdf}:argon2i:int` as StoreKeyMethod),
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
