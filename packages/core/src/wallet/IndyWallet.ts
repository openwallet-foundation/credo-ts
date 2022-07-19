import type { KeyPair } from '../crypto/signing-provider/SigningProvider'
import type {
  EncryptedMessage,
  KeyDerivationMethod,
  WalletConfig,
  WalletConfigRekey,
  WalletExportImportConfig,
} from '../types'
import type { Buffer } from '../utils/buffer'
import type {
  CreateKeyOptions,
  DidConfig,
  DidInfo,
  SignOptions,
  UnpackedMessageContext,
  VerifyOptions,
  Wallet,
} from './Wallet'
import type { default as Indy, WalletStorageConfig } from 'indy-sdk'

import { inject, injectable } from 'tsyringe'

import { AgentDependencies } from '../agent/AgentDependencies'
import { InjectionSymbols } from '../constants'
import { KeyType } from '../crypto'
import { Key } from '../crypto/Key'
import { SigningProviderRegistry } from '../crypto/signing-provider/SigningProviderRegistry'
import { AriesFrameworkError, IndySdkError, RecordDuplicateError, RecordNotFoundError } from '../error'
import { Logger } from '../logger'
import { TypedArrayEncoder } from '../utils'
import { JsonEncoder } from '../utils/JsonEncoder'
import { isError } from '../utils/error'
import { isIndyError } from '../utils/indyError'

import { WalletDuplicateError, WalletError, WalletNotFoundError } from './error'
import { WalletInvalidKeyError } from './error/WalletInvalidKeyError'

@injectable()
export class IndyWallet implements Wallet {
  private walletConfig?: WalletConfig
  private walletHandle?: number

  private logger: Logger
  private signingKeyProviderRegistry: SigningProviderRegistry
  private publicDidInfo: DidInfo | undefined
  private indy: typeof Indy

  public constructor(
    @inject(InjectionSymbols.AgentDependencies) agentDependencies: AgentDependencies,
    @inject(InjectionSymbols.Logger) logger: Logger,
    signingKeyProviderRegistry: SigningProviderRegistry
  ) {
    this.logger = logger
    this.signingKeyProviderRegistry = signingKeyProviderRegistry
    this.indy = agentDependencies.indy
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

  public get masterSecretId() {
    if (!this.isInitialized || !this.walletConfig?.id) {
      throw new AriesFrameworkError(
        'Wallet has not been initialized yet. Make sure to await agent.initialize() before using the agent.'
      )
    }

    return this.walletConfig.id
  }

  /**
   * Dispose method is called when an agent context is disposed.
   */
  public async dispose() {
    if (this.isInitialized) {
      await this.close()
    }
  }

  private walletStorageConfig(walletConfig: WalletConfig): Indy.WalletConfig {
    const walletStorageConfig: Indy.WalletConfig = {
      id: walletConfig.id,
      storage_type: walletConfig.storage?.type,
    }

    if (walletConfig.storage?.config) {
      walletStorageConfig.storage_config = walletConfig.storage?.config as WalletStorageConfig
    }

    return walletStorageConfig
  }

  private walletCredentials(
    walletConfig: WalletConfig,
    rekey?: string,
    rekeyDerivation?: KeyDerivationMethod
  ): Indy.OpenWalletCredentials {
    const walletCredentials: Indy.OpenWalletCredentials = {
      key: walletConfig.key,
      key_derivation_method: walletConfig.keyDerivationMethod,
    }
    if (rekey) {
      walletCredentials.rekey = rekey
    }
    if (rekeyDerivation) {
      walletCredentials.rekey_derivation_method = rekeyDerivation
    }
    if (walletConfig.storage?.credentials) {
      walletCredentials.storage_credentials = walletConfig.storage?.credentials as Record<string, unknown>
    }

    return walletCredentials
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
    this.logger.debug(`Creating wallet '${walletConfig.id}' using SQLite storage`)

    try {
      await this.indy.createWallet(this.walletStorageConfig(walletConfig), this.walletCredentials(walletConfig))
      this.walletConfig = walletConfig

      // We usually want to create master secret only once, therefore, we can to do so when creating a wallet.
      await this.open(walletConfig)

      // We need to open wallet before creating master secret because we need wallet handle here.
      await this.createMasterSecret(this.handle, walletConfig.id)
    } catch (error) {
      // If an error ocurred while creating the master secret, we should close the wallet
      if (this.isInitialized) await this.close()

      if (isIndyError(error, 'WalletAlreadyExistsError')) {
        const errorMessage = `Wallet '${walletConfig.id}' already exists`
        this.logger.debug(errorMessage)

        throw new WalletDuplicateError(errorMessage, {
          walletType: 'IndyWallet',
          cause: error,
        })
      } else {
        if (!isError(error)) {
          throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error')
        }
        const errorMessage = `Error creating wallet '${walletConfig.id}'`
        this.logger.error(errorMessage, {
          error,
          errorMessage: error.message,
        })

        throw new WalletError(errorMessage, { cause: error })
      }
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

    try {
      this.walletHandle = await this.indy.openWallet(
        this.walletStorageConfig(walletConfig),
        this.walletCredentials(walletConfig, rekey, rekeyDerivation)
      )
      if (rekey) {
        this.walletConfig = { ...walletConfig, key: rekey, keyDerivationMethod: rekeyDerivation }
      } else {
        this.walletConfig = walletConfig
      }
    } catch (error) {
      if (isIndyError(error, 'WalletNotFoundError')) {
        const errorMessage = `Wallet '${walletConfig.id}' not found`
        this.logger.debug(errorMessage)

        throw new WalletNotFoundError(errorMessage, {
          walletType: 'IndyWallet',
          cause: error,
        })
      } else if (isIndyError(error, 'WalletAccessFailed')) {
        const errorMessage = `Incorrect key for wallet '${walletConfig.id}'`
        this.logger.debug(errorMessage)
        throw new WalletInvalidKeyError(errorMessage, {
          walletType: 'IndyWallet',
          cause: error,
        })
      } else {
        if (!isError(error)) {
          throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error')
        }
        const errorMessage = `Error opening wallet '${walletConfig.id}': ${error.message}`
        this.logger.error(errorMessage, {
          error,
          errorMessage: error.message,
        })

        throw new WalletError(errorMessage, { cause: error })
      }
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
      await this.indy.deleteWallet(
        this.walletStorageConfig(this.walletConfig),
        this.walletCredentials(this.walletConfig)
      )
    } catch (error) {
      if (isIndyError(error, 'WalletNotFoundError')) {
        const errorMessage = `Error deleting wallet: wallet '${this.walletConfig.id}' not found`
        this.logger.debug(errorMessage)

        throw new WalletNotFoundError(errorMessage, {
          walletType: 'IndyWallet',
          cause: error,
        })
      } else {
        if (!isError(error)) {
          throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error')
        }
        const errorMessage = `Error deleting wallet '${this.walletConfig.id}': ${error.message}`
        this.logger.error(errorMessage, {
          error,
          errorMessage: error.message,
        })

        throw new WalletError(errorMessage, { cause: error })
      }
    }
  }

  public async export(exportConfig: WalletExportImportConfig) {
    try {
      this.logger.debug(`Exporting wallet ${this.walletConfig?.id} to path ${exportConfig.path}`)
      await this.indy.exportWallet(this.handle, exportConfig)
    } catch (error) {
      if (!isError(error)) {
        throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error')
      }
      const errorMessage = `Error exporting wallet: ${error.message}`
      this.logger.error(errorMessage, {
        error,
      })

      throw new WalletError(errorMessage, { cause: error })
    }
  }

  public async import(walletConfig: WalletConfig, importConfig: WalletExportImportConfig) {
    try {
      this.logger.debug(`Importing wallet ${walletConfig.id} from path ${importConfig.path}`)
      await this.indy.importWallet(
        { id: walletConfig.id },
        { key: walletConfig.key, key_derivation_method: walletConfig.keyDerivationMethod },
        importConfig
      )
    } catch (error) {
      if (!isError(error)) {
        throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error')
      }
      const errorMessage = `Error importing wallet': ${error.message}`
      this.logger.error(errorMessage, {
        error,
      })

      throw new WalletError(errorMessage, { cause: error })
    }
  }

  /**
   * @throws {WalletError} if the wallet is already closed or another error occurs
   */
  public async close(): Promise<void> {
    this.logger.debug(`Closing wallet ${this.walletConfig?.id}`)
    if (!this.walletHandle) {
      throw new WalletError('Wallet is in invalid state, you are trying to close wallet that has no `walletHandle`.')
    }

    try {
      await this.indy.closeWallet(this.walletHandle)
      this.walletHandle = undefined
      this.publicDidInfo = undefined
    } catch (error) {
      if (isIndyError(error, 'WalletInvalidHandle')) {
        const errorMessage = `Error closing wallet: wallet already closed`
        this.logger.debug(errorMessage)

        throw new WalletError(errorMessage, {
          cause: error,
        })
      } else {
        if (!isError(error)) {
          throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error')
        }
        const errorMessage = `Error closing wallet': ${error.message}`
        this.logger.error(errorMessage, {
          error,
          errorMessage: error.message,
        })

        throw new WalletError(errorMessage, { cause: error })
      }
    }
  }

  /**
   * Create master secret with specified id in currently opened wallet.
   *
   * If a master secret by this id already exists in the current wallet, the method
   * will return without doing anything.
   *
   * @throws {WalletError} if an error occurs
   */
  private async createMasterSecret(walletHandle: number, masterSecretId: string): Promise<string> {
    this.logger.debug(`Creating master secret with id '${masterSecretId}' in wallet with handle '${walletHandle}'`)

    try {
      await this.indy.proverCreateMasterSecret(walletHandle, masterSecretId)

      return masterSecretId
    } catch (error) {
      if (isIndyError(error, 'AnoncredsMasterSecretDuplicateNameError')) {
        // master secret id is the same as the master secret id passed in the create function
        // so if it already exists we can just assign it.
        this.logger.debug(
          `Master secret with id '${masterSecretId}' already exists in wallet with handle '${walletHandle}'`,
          {
            indyError: 'AnoncredsMasterSecretDuplicateNameError',
          }
        )

        return masterSecretId
      } else {
        if (!isIndyError(error)) {
          throw new AriesFrameworkError('Attempted to throw Indy error, but it was not an Indy error')
        }

        this.logger.error(`Error creating master secret with id ${masterSecretId}`, {
          indyError: error.indyName,
          error,
        })

        throw new WalletError(
          `Error creating master secret with id ${masterSecretId} in wallet with handle '${walletHandle}'`,
          { cause: error }
        )
      }
    }
  }

  public async initPublicDid(didConfig: DidConfig) {
    const { did, verkey } = await this.createDid(didConfig)
    this.publicDidInfo = {
      did,
      verkey,
    }
  }

  public async createDid(didConfig?: DidConfig): Promise<DidInfo> {
    try {
      const [did, verkey] = await this.indy.createAndStoreMyDid(this.handle, didConfig || {})

      return { did, verkey }
    } catch (error) {
      if (!isError(error)) {
        throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error')
      }
      throw new WalletError('Error creating Did', { cause: error })
    }
  }

  /**
   * Create a key with an optional seed and keyType.
   * The keypair is also automatically stored in the wallet afterwards
   *
   * Bls12381g1g2 and X25519 are not supported.
   *
   * @param seed string The seed for creating a key
   * @param keyType KeyType the type of key that should be created
   *
   * @returns a Key instance with a publicKeyBase58
   *
   * @throws {WalletError} When an unsupported keytype is requested
   * @throws {WalletError} When the key could not be created
   */
  public async createKey({ seed, keyType }: CreateKeyOptions): Promise<Key> {
    try {
      // Ed25519 is supported natively in Indy wallet
      if (keyType === KeyType.Ed25519) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        const verkey = await this.indy.createKey(this.handle, { seed, crypto_type: 'ed25519' })
        return Key.fromPublicKeyBase58(verkey, keyType)
      }

      // Check if there is a signing key provider for the specified key type.
      if (this.signingKeyProviderRegistry.hasProviderForKeyType(keyType)) {
        const signingKeyProvider = this.signingKeyProviderRegistry.getProviderForKeyType(keyType)

        const keyPair = await signingKeyProvider.createKeyPair({ seed })
        await this.storeKeyPair(keyPair)
        return Key.fromPublicKeyBase58(keyPair.publicKeyBase58, keyType)
      }
    } catch (error) {
      if (!isError(error)) {
        throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error')
      }
      throw new WalletError(`Error creating key with key type '${keyType}': ${error.message}`, { cause: error })
    }

    throw new WalletError(`Unsupported key type: '${keyType}' for wallet IndyWallet`)
  }

  /**
   * sign a Buffer with an instance of a Key class
   *
   * Bls12381g1g2, Bls12381g1 and X25519 are not supported.
   *
   * @param data Buffer The data that needs to be signed
   * @param key Key The key that is used to sign the data
   *
   * @returns A signature for the data
   */
  public async sign({ data, key }: SignOptions): Promise<Buffer> {
    try {
      // Ed25519 is supported natively in Indy wallet
      if (key.keyType === KeyType.Ed25519) {
        // Checks to see if it is an not an Array of messages, but just a single one
        if (!TypedArrayEncoder.isTypedArray(data)) {
          throw new WalletError(`${KeyType.Ed25519} does not support multiple singing of multiple messages`)
        }
        return await this.indy.cryptoSign(this.handle, key.publicKeyBase58, data as Buffer)
      }

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
    } catch (error) {
      if (!isError(error)) {
        throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error')
      }
      throw new WalletError(`Error signing data with verkey ${key.publicKeyBase58}`, { cause: error })
    }
    throw new WalletError(`Unsupported keyType: ${key.keyType}`)
  }

  /**
   * Verify the signature with the data and the used key
   *
   * Bls12381g1g2, Bls12381g1 and X25519 are not supported.
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
  public async verify({ data, key, signature }: VerifyOptions): Promise<boolean> {
    try {
      // Ed25519 is supported natively in Indy wallet
      if (key.keyType === KeyType.Ed25519) {
        // Checks to see if it is an not an Array of messages, but just a single one
        if (!TypedArrayEncoder.isTypedArray(data)) {
          throw new WalletError(`${KeyType.Ed25519} does not support multiple singing of multiple messages`)
        }
        return await this.indy.cryptoVerify(key.publicKeyBase58, data as Buffer, signature)
      }

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
    } catch (error) {
      if (!isError(error)) {
        throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error')
      }
      throw new WalletError(`Error verifying signature of data signed with verkey ${key.publicKeyBase58}`, {
        cause: error,
      })
    }
    throw new WalletError(`Unsupported keyType: ${key.keyType}`)
  }

  public async pack(
    payload: Record<string, unknown>,
    recipientKeys: string[],
    senderVerkey?: string
  ): Promise<EncryptedMessage> {
    try {
      const messageRaw = JsonEncoder.toBuffer(payload)
      const packedMessage = await this.indy.packMessage(this.handle, messageRaw, recipientKeys, senderVerkey ?? null)
      return JsonEncoder.fromBuffer(packedMessage)
    } catch (error) {
      if (!isError(error)) {
        throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error')
      }
      throw new WalletError('Error packing message', { cause: error })
    }
  }

  public async unpack(messagePackage: EncryptedMessage): Promise<UnpackedMessageContext> {
    try {
      const unpackedMessageBuffer = await this.indy.unpackMessage(this.handle, JsonEncoder.toBuffer(messagePackage))
      const unpackedMessage = JsonEncoder.fromBuffer(unpackedMessageBuffer)
      return {
        senderKey: unpackedMessage.sender_verkey,
        recipientKey: unpackedMessage.recipient_verkey,
        plaintextMessage: JsonEncoder.fromString(unpackedMessage.message),
      }
    } catch (error) {
      if (!isError(error)) {
        throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error')
      }
      throw new WalletError('Error unpacking message', { cause: error })
    }
  }

  public async generateNonce(): Promise<string> {
    try {
      return await this.indy.generateNonce()
    } catch (error) {
      if (!isError(error)) {
        throw new AriesFrameworkError('Attempted to throw error, but it was not of type Error')
      }
      throw new WalletError('Error generating nonce', { cause: error })
    }
  }

  private async retrieveKeyPair(publicKeyBase58: string): Promise<KeyPair> {
    try {
      const { value } = await this.indy.getWalletRecord(this.handle, 'KeyPairRecord', `key-${publicKeyBase58}`, {})
      if (value) {
        return JsonEncoder.fromString(value) as KeyPair
      } else {
        throw new WalletError(`No content found for record with public key: ${publicKeyBase58}`)
      }
    } catch (error) {
      if (isIndyError(error, 'WalletItemNotFound')) {
        throw new RecordNotFoundError(`KeyPairRecord not found for public key: ${publicKeyBase58}.`, {
          recordType: 'KeyPairRecord',
          cause: error,
        })
      }
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  private async storeKeyPair(keyPair: KeyPair): Promise<void> {
    try {
      await this.indy.addWalletRecord(
        this.handle,
        'KeyPairRecord',
        `key-${keyPair.publicKeyBase58}`,
        JSON.stringify(keyPair),
        {
          keyType: keyPair.keyType,
        }
      )
    } catch (error) {
      if (isIndyError(error, 'WalletItemAlreadyExists')) {
        throw new RecordDuplicateError(`Record already exists`, { recordType: 'KeyPairRecord' })
      }
      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async generateWalletKey() {
    try {
      return await this.indy.generateWalletKey()
    } catch (error) {
      throw new WalletError('Error generating wallet key', { cause: error })
    }
  }
}
