import type { Logger } from '../logger'
import type { EncryptedMessage, DecryptedMessageContext, WalletConfig, WalletExportImportConfig } from '../types'
import type { Buffer } from '../utils/buffer'
import type { Wallet, DidInfo, DidConfig, CreateKeyOptions } from './Wallet'
import type { default as Indy } from 'indy-sdk'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../agent/AgentConfig'
import { KeyType } from '../crypto'
import { Key } from '../crypto/Key'
import { AriesFrameworkError } from '../error'
import { JsonEncoder } from '../utils/JsonEncoder'
import { isIndyError } from '../utils/indyError'

import { WalletDuplicateError, WalletNotFoundError, WalletError } from './error'
import { WalletInvalidKeyError } from './error/WalletInvalidKeyError'

@scoped(Lifecycle.ContainerScoped)
export class IndyWallet implements Wallet {
  private walletConfig?: WalletConfig
  private walletHandle?: number

  private logger: Logger
  private publicDidInfo: DidInfo | undefined
  private indy: typeof Indy

  public constructor(agentConfig: AgentConfig) {
    this.logger = agentConfig.logger
    this.indy = agentConfig.agentDependencies.indy
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
      await this.indy.createWallet(
        { id: walletConfig.id },
        { key: walletConfig.key, key_derivation_method: walletConfig.keyDerivationMethod }
      )

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
    if (this.walletHandle) {
      throw new WalletError(
        'Wallet instance already opened. Close the currently opened wallet before re-opening the wallet'
      )
    }

    try {
      this.walletHandle = await this.indy.openWallet(
        { id: walletConfig.id },
        { key: walletConfig.key, key_derivation_method: walletConfig.keyDerivationMethod }
      )
      this.walletConfig = walletConfig
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
        const errorMessage = `Error opening wallet '${walletConfig.id}'`
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
        { id: this.walletConfig.id },
        { key: this.walletConfig.key, key_derivation_method: this.walletConfig.keyDerivationMethod }
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
      const errorMessage = `Error exporting wallet': ${error.message}`
      this.logger.error(errorMessage, {
        error,
      })

      throw new WalletError(errorMessage, { cause: error })
    }
  }

  public async import(walletConfig: WalletConfig, importConfig: WalletExportImportConfig) {
    try {
      this.logger.debug(`Importing wallet ${walletConfig.id} from path ${importConfig.path}`)
      await this.indy.importWallet({ id: walletConfig.id }, { key: walletConfig.key }, importConfig)
    } catch (error) {
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
      throw new WalletError('Error creating Did', { cause: error })
    }
  }

  public async createKey({ seed, keyType }: CreateKeyOptions): Promise<Key> {
    if (keyType !== KeyType.Ed25519) {
      throw new WalletError(`Unsupported key type: '${keyType}' for wallet IndyWallet`)
    }

    try {
      const publicKeyBase58 = await this.indy.createKey(this.handle, { seed })

      return Key.fromPublicKeyBase58(publicKeyBase58, keyType)
    } catch (error) {
      throw new WalletError(`Error creating key with key type '${keyType}': ${error.message}`, { cause: error })
    }
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
      throw new WalletError('Error packing message', { cause: error })
    }
  }

  public async unpack(messagePackage: EncryptedMessage): Promise<DecryptedMessageContext> {
    try {
      const unpackedMessageBuffer = await this.indy.unpackMessage(this.handle, JsonEncoder.toBuffer(messagePackage))
      const unpackedMessage = JsonEncoder.fromBuffer(unpackedMessageBuffer)
      return {
        senderKey: unpackedMessage.sender_verkey,
        recipientKey: unpackedMessage.recipient_verkey,
        plaintextMessage: JsonEncoder.fromString(unpackedMessage.message),
      }
    } catch (error) {
      throw new WalletError('Error unpacking message', { cause: error })
    }
  }

  public async sign(data: Buffer, verkey: string): Promise<Buffer> {
    try {
      return await this.indy.cryptoSign(this.handle, verkey, data)
    } catch (error) {
      throw new WalletError(`Error signing data with verkey ${verkey}`, { cause: error })
    }
  }

  public async verify(signerVerkey: string, data: Buffer, signature: Buffer): Promise<boolean> {
    try {
      // check signature
      const isValid = await this.indy.cryptoVerify(signerVerkey, data, signature)

      return isValid
    } catch (error) {
      throw new WalletError(`Error verifying signature of data signed with verkey ${signerVerkey}`, { cause: error })
    }
  }

  public async generateNonce() {
    try {
      return await this.indy.generateNonce()
    } catch (error) {
      throw new WalletError('Error generating nonce', { cause: error })
    }
  }
}
