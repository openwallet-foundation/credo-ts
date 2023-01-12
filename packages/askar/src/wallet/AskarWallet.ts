import type {
  EncryptedMessage,
  WalletConfig,
  WalletCreateKeyOptions,
  DidConfig,
  DidInfo,
  WalletSignOptions,
  UnpackedMessageContext,
  WalletVerifyOptions,
  Wallet,
  WalletExportImportConfig,
  WalletConfigRekey,
} from '@aries-framework/core'
import type { Session } from 'aries-askar-shared'

import {
  Buffer,
  KeyDerivationMethod,
  AriesFrameworkError,
  Logger,
  WalletError,
  InjectionSymbols,
  Key,
  SigningProviderRegistry,
  TypedArrayEncoder,
  FileSystem,
} from '@aries-framework/core'
import { CryptoBox, Store, StoreKeyMethod, Key as AskarKey, keyAlgFromString } from 'aries-askar-shared'

const isError = (error: unknown): error is Error => error instanceof Error

import { inject, injectable } from 'tsyringe'
import { TextDecoder, TextEncoder } from 'util'

import { encodeToBase58 } from '../../../core/src/utils/base58'

@injectable()
export class AskarWallet implements Wallet {
  private walletConfig?: WalletConfig
  private walletHandle?: Store
  private _session?: Session

  private logger: Logger
  private fileSystem: FileSystem

  private signingKeyProviderRegistry: SigningProviderRegistry
  private publicDidInfo: DidInfo | undefined

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
    return this.walletHandle !== undefined
  }

  public get publicDid() {
    return this.publicDidInfo
  }

  public get handle() {
    if (!this.walletHandle) {
      throw new AriesFrameworkError(
        'Wallet has not been initialized yet. Make sure to await agent.initialize() before using the agent.'
      )
    }

    return this.walletHandle
  }

  public get session() {
    if (!this._session) {
      throw new AriesFrameworkError('No Wallet Session is opened')
    }

    return this._session
  }

  public get masterSecretId() {
    if (!this.isInitialized || !(this.walletConfig?.id || this.walletConfig?.masterSecretId)) {
      throw new AriesFrameworkError(
        'Wallet has not been initialized yet. Make sure to await agent.initialize() before using the agent.'
      )
    }

    return this.walletConfig?.masterSecretId ?? this.walletConfig.id
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

  private async askarWalletConfig(walletConfig: WalletConfig) {
    const keyDerivationMethodToStoreKeyMethod = (keyDerivationMethod?: KeyDerivationMethod) => {
      if (!keyDerivationMethod) {
        return undefined
      }

      const correspondanceTable = {
        [KeyDerivationMethod.Raw]: StoreKeyMethod.Raw,
        [KeyDerivationMethod.Argon2IInt]: `${StoreKeyMethod.Kdf}:argon2i:int`,
        [KeyDerivationMethod.Argon2IMod]: `${StoreKeyMethod.Kdf}:argon2i:mod`,
      }

      return correspondanceTable[keyDerivationMethod] as StoreKeyMethod
    }

    const uri = await this.getUri(walletConfig)

    return {
      uri,
      profile: walletConfig.id,
      keyMethod: keyDerivationMethodToStoreKeyMethod(walletConfig.keyDerivationMethod),
      passKey: walletConfig.key,
    }
  }

  private async getUri(walletConfig: WalletConfig) {
    // By default use sqlite as database backend
    let uri = ''
    if (!walletConfig.storage) {
      walletConfig.storage = { type: 'sqlite' }
    }

    if (walletConfig.storage.type === 'sqlite') {
      if (walletConfig.storage.inMemory) {
        uri = 'sqlite://:memory:'
      } else {
        const path = `${(walletConfig.storage.path as string) ?? this.fileSystem.basePath + '/wallet'}/${
          walletConfig.id
        }/sqlite.db`

        // Make sure path exists before creating the wallet
        await this.fileSystem.createDirectory(path)
        uri = `sqlite://${path}`
      }
      // TODO postgres
    } else {
      throw new WalletError(`Storage type not supported: ${walletConfig.storage.type}`)
    }

    return uri
  }
  /**
   * @throws {WalletDuplicateError} if the wallet already exists
   * @throws {WalletError} if another error occurs
   */
  public async createAndOpen(walletConfig: WalletConfig): Promise<void> {
    this.logger.debug(`Creating wallet '${walletConfig.id}`)

    const askarWalletConfig = await this.askarWalletConfig(walletConfig)
    try {
      this.walletHandle = await Store.provision({
        recreate: false,
        uri: askarWalletConfig.uri,
        profile: askarWalletConfig.profile,
        keyMethod: askarWalletConfig.keyMethod,
        passKey: askarWalletConfig.passKey,
      })
      this.walletConfig = walletConfig
      this._session = await this.walletHandle.openSession()

      // TODO: Master Secret creation (now part of IndyCredx/AnonCreds)
    } catch (error) {
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
    if (this.walletHandle) {
      throw new WalletError(
        'Wallet instance already opened. Close the currently opened wallet before re-opening the wallet'
      )
    }

    const askarWalletConfig = await this.askarWalletConfig(walletConfig)

    try {
      this.walletHandle = await Store.open({
        uri: askarWalletConfig.uri,
        keyMethod: askarWalletConfig.keyMethod,
        passKey: askarWalletConfig.passKey,
      })

      this._session = await this.walletHandle.openSession()

      // TODO: key rotation
      this.walletConfig = walletConfig
    } catch (error) {
      // TODO: Improve errors
      throw new WalletError(error.message, { cause: error })
    }

    this.logger.debug(`Wallet '${walletConfig.id}' opened with handle '${this.handle}'`)
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

    if (this.walletHandle) {
      await this.close()
    }

    try {
      await Store.remove(await this.getUri(this.walletConfig))
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
    // TODO
    throw new WalletError('Export not yet implemented')
  }

  public async import(walletConfig: WalletConfig, importConfig: WalletExportImportConfig) {
    // TODO
    throw new WalletError('Import not yet implemented')
  }

  /**
   * @throws {WalletError} if the wallet is already closed or another error occurs
   */
  public async close(): Promise<void> {
    this.logger.debug(`Closing wallet ${this.walletConfig?.id}`)
    if (!this.walletHandle) {
      throw new WalletError('Wallet is in invalid state, you are trying to close wallet that has no handle.')
    }

    try {
      await this._session?.close()
      await this.walletHandle.close()
      this.walletHandle = undefined
      this.publicDidInfo = undefined
    } catch (error) {
      const errorMessage = `Error closing wallet': ${error.message}`
      this.logger.error(errorMessage, {
        error,
        errorMessage: error.message,
      })

      throw new WalletError(errorMessage, { cause: error })
    }
  }

  public async initPublicDid(didConfig: DidConfig) {
    // Not implemented, as it does not work with legacy Ledger module
  }

  /**
   * Create a key with an optional seed and keyType.
   * The keypair is also automatically stored in the wallet afterwards
   *
   * TODO: use signingKeyProviderRegistry to support algorithms not implemented in Askar
   *
   * @param seed string The seed for creating a key
   * @param keyType KeyType the type of key that should be created
   *
   * @returns a Key instance with a publicKeyBase58
   *
   * @throws {WalletError} When an unsupported keytype is requested
   * @throws {WalletError} When the key could not be created
   */
  public async createKey({ seed, keyType }: WalletCreateKeyOptions): Promise<Key> {
    try {
      const algorithm = keyAlgFromString(keyType)

      // Create key from seed
      const key = AskarKey.fromSeed({ seed: new TextEncoder().encode(seed), algorithm })

      // Store key
      await this._session?.insertKey({ key, name: encodeToBase58(key.publicBytes) })

      return Key.fromPublicKey(key.publicBytes, keyType)
    } catch (error) {
      if (!isError(error)) {
        throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error', { cause: error })
      }
      throw new WalletError(`Error creating key with key type '${keyType}': ${error.message}`, { cause: error })
    }
  }

  /**
   * sign a Buffer with an instance of a Key class
   *
   * TODO: use signingKeyProviderRegistry to support algorithms not implemented in Askar
   *
   * @param data Buffer The data that needs to be signed
   * @param key Key The key that is used to sign the data
   *
   * @returns A signature for the data
   */
  public async sign({ data, key }: WalletSignOptions): Promise<Buffer> {
    try {
      const keyEntry = await this._session?.fetchKey({ name: key.publicKeyBase58 })

      if (!keyEntry) {
        throw new WalletError('Key entry not found')
      }

      if (!TypedArrayEncoder.isTypedArray(data)) {
        throw new WalletError(`Currently not suppirting signing of multiple messages`)
      }

      const signed = keyEntry.key.signMessage({ message: data as Buffer })

      return Buffer.from(signed)
    } catch (error) {
      if (!isError(error)) {
        throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error', { cause: error })
      }
      throw new WalletError(`Error signing data with verkey ${key.publicKeyBase58}`, { cause: error })
    }
  }

  /**
   * Verify the signature with the data and the used key
   *
   * TODO: use signingKeyProviderRegistry to support algorithms not implemented in Askar
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
    try {
      const keyEntry = await this._session?.fetchKey({ name: key.publicKeyBase58 })

      if (!keyEntry) {
        throw new WalletError('Key entry not found')
      }

      if (!TypedArrayEncoder.isTypedArray(data)) {
        throw new WalletError(`Currently not supporting signature of multiple messages`)
      }

      return keyEntry.key.verifySignature({ message: data as Buffer, signature })
    } catch (error) {
      if (!isError(error)) {
        throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error', { cause: error })
      }
      throw new WalletError(`Error signing data with verkey ${key.publicKeyBase58}`, { cause: error })
    }
  }

  public async pack(
    payload: Record<string, unknown>,
    recipientKeys: string[],
    senderVerkey?: string
  ): Promise<EncryptedMessage> {
    // TODO
    throw new WalletError('Pack not yet implemented')
  }

  public async unpack(messagePackage: EncryptedMessage): Promise<UnpackedMessageContext> {
    // TODO
    throw new WalletError('Unpack not yet implemented')
  }

  public async generateNonce(): Promise<string> {
    try {
      return new TextDecoder().decode(CryptoBox.randomNonce())
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
}
