import type { WalletConfig, WalletConfigRekey, WalletExportImportConfig } from '@credo-ts/core'

import {
  WalletExportPathExistsError,
  WalletInvalidKeyError,
  WalletDuplicateError,
  CredoError,
  Logger,
  WalletError,
  InjectionSymbols,
  SigningProviderRegistry,
  FileSystem,
  WalletNotFoundError,
  KeyDerivationMethod,
  WalletImportPathExistsError,
  WalletExportUnsupportedError,
} from '@credo-ts/core'
import { inject, injectable } from 'tsyringe'

import { AskarModuleConfig } from '../AskarModuleConfig'
import { AskarErrorCode, isAskarError, keyDerivationMethodToStoreKeyMethod, uriFromWalletConfig } from '../utils'
import { Store } from '../utils/importAskar'

import { AskarBaseWallet } from './AskarBaseWallet'
import { isAskarWalletSqliteStorageConfig } from './AskarWalletStorageConfig'

/**
 * @todo: rename after 0.5.0, as we now have multiple types of AskarWallet
 */
@injectable()
export class AskarWallet extends AskarBaseWallet {
  private fileSystem: FileSystem

  private walletConfig?: WalletConfig
  private _store?: Store

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    @inject(InjectionSymbols.FileSystem) fileSystem: FileSystem,
    signingKeyProviderRegistry: SigningProviderRegistry,
    config: AskarModuleConfig
  ) {
    super(logger, signingKeyProviderRegistry, config)
    this.fileSystem = fileSystem
  }

  public get isProvisioned() {
    return this.walletConfig !== undefined
  }

  public get isInitialized() {
    return this._store !== undefined
  }

  public get store() {
    if (!this._store) {
      throw new CredoError(
        'Wallet has not been initialized yet. Make sure to await agent.initialize() before using the agent.'
      )
    }

    return this._store
  }

  public get profile() {
    if (!this.walletConfig) {
      throw new WalletError('No profile configured.')
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
      // Make sure path exists before creating the wallet
      if (filePath) {
        await this.fileSystem.createDirectory(filePath)
      }

      this._store = await this.config.askarLibrary.Store.provision({
        recreate: false,
        uri: askarWalletConfig.uri,
        profile: askarWalletConfig.profile,
        // Need to cast due to type mismatch between HL/OWF askar
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        keyMethod: askarWalletConfig.keyMethod as any,
        passKey: askarWalletConfig.passKey,
      })

      // TODO: Should we do something to check if it exists?
      // Like this.withSession()?

      this.walletConfig = walletConfig
    } catch (error) {
      // FIXME: Askar should throw a Duplicate error code, but is currently returning Encryption
      // And if we provide the very same wallet key, it will open it without any error
      if (
        isAskarError(this.config.askarLibrary, error) &&
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
      this._store = await this.config.askarLibrary.Store.open({
        uri: askarWalletConfig.uri,
        // Need to cast due to type mismatch between HL/OWF askar
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        keyMethod: askarWalletConfig.keyMethod as any,
        passKey: askarWalletConfig.passKey,
      })

      if (rekey) {
        await this._store.rekey({
          passKey: rekey,
          // Need to cast due to type mismatch between HL/OWF askar
          keyMethod: keyDerivationMethodToStoreKeyMethod(
            this.config.askarLibrary,
            rekeyDerivation ?? KeyDerivationMethod.Argon2IMod
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ) as any,
        })
      }

      // TODO: Should we do something to check if it exists?
      // Like this.withSession()?

      this.walletConfig = walletConfig
    } catch (error) {
      if (
        isAskarError(this.config.askarLibrary, error) &&
        (error.code === AskarErrorCode.NotFound ||
          (error.code === AskarErrorCode.Backend &&
            isAskarWalletSqliteStorageConfig(walletConfig.storage) &&
            walletConfig.storage.config?.inMemory))
      ) {
        const errorMessage = `Wallet '${walletConfig.id}' not found`
        this.logger.debug(errorMessage)

        throw new WalletNotFoundError(errorMessage, {
          walletType: 'AskarWallet',
          cause: error,
        })
      } else if (isAskarError(this.config.askarLibrary, error) && error.code === AskarErrorCode.Encryption) {
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
      await this.config.askarLibrary.Store.remove(uri)
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

    if (isAskarWalletSqliteStorageConfig(this.walletConfig.storage) && this.walletConfig.storage?.inMemory) {
      throw new WalletExportUnsupportedError('Export is not supported for in memory wallet')
    }
    if (!sourcePath) {
      throw new WalletExportUnsupportedError('Export is only supported for SQLite backend')
    }

    try {
      // Export path already exists
      if (await this.fileSystem.exists(destinationPath)) {
        throw new WalletExportPathExistsError(
          `Unable to create export, wallet export at path '${exportConfig.path}' already exists`
        )
      }
      const exportedWalletConfig = await this.getAskarWalletConfig({
        ...this.walletConfig,
        key: exportKey,
        storage: { type: 'sqlite', config: { path: destinationPath } },
      })

      // Make sure destination path exists
      await this.fileSystem.createDirectory(destinationPath)

      await this.store.copyTo({
        recreate: false,
        uri: exportedWalletConfig.uri,
        // Need to cast due to type mismatch between HL/OWF askar
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        keyMethod: exportedWalletConfig.keyMethod as any,
        passKey: exportedWalletConfig.passKey,
      })
    } catch (error) {
      const errorMessage = `Error exporting wallet '${this.walletConfig.id}': ${error.message}`
      this.logger.error(errorMessage, {
        error,
        errorMessage: error.message,
      })

      if (error instanceof WalletExportPathExistsError) throw error

      throw new WalletError(errorMessage, { cause: error })
    }
  }

  public async import(walletConfig: WalletConfig, importConfig: WalletExportImportConfig) {
    const { path: sourcePath, key: importKey } = importConfig
    const { path: destinationPath } = uriFromWalletConfig(walletConfig, this.fileSystem.dataPath)

    if (!destinationPath) {
      throw new WalletError('Import is only supported for SQLite backend')
    }

    let sourceWalletStore: Store | undefined = undefined
    try {
      const importWalletConfig = await this.getAskarWalletConfig(walletConfig)

      // Import path already exists
      if (await this.fileSystem.exists(destinationPath)) {
        throw new WalletExportPathExistsError(`Unable to import wallet. Path '${destinationPath}' already exists`)
      }

      // Make sure destination path exists
      await this.fileSystem.createDirectory(destinationPath)
      // Open imported wallet and copy to destination
      sourceWalletStore = await this.config.askarLibrary.Store.open({
        uri: `sqlite://${sourcePath}`,
        // Need to cast due to type mismatch between HL/OWF askar
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        keyMethod: importWalletConfig.keyMethod as any,
        passKey: importKey,
      })

      const defaultProfile = await sourceWalletStore.getDefaultProfile()
      if (defaultProfile !== importWalletConfig.profile) {
        throw new WalletError(
          `Trying to import wallet with walletConfig.id ${importWalletConfig.profile}, however the wallet contains a default profile with id ${defaultProfile}. The walletConfig.id MUST match with the default profile. In the future this behavior may be changed. See https://github.com/hyperledger/aries-askar/issues/221 for more information.`
        )
      }

      await sourceWalletStore.copyTo({
        recreate: false,
        uri: importWalletConfig.uri,

        // Need to cast due to type mismatch between HL/OWF askar
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        keyMethod: importWalletConfig.keyMethod as any,
        passKey: importWalletConfig.passKey,
      })

      await sourceWalletStore.close()
    } catch (error) {
      await sourceWalletStore?.close()
      const errorMessage = `Error importing wallet '${walletConfig.id}': ${error.message}`
      this.logger.error(errorMessage, {
        error,
        errorMessage: error.message,
      })

      if (error instanceof WalletImportPathExistsError) throw error

      // Cleanup any wallet file we could have created
      if (await this.fileSystem.exists(destinationPath)) {
        await this.fileSystem.delete(destinationPath)
      }

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
      await this.store.close()
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

  private async getAskarWalletConfig(walletConfig: WalletConfig) {
    const { uri, path } = uriFromWalletConfig(walletConfig, this.fileSystem.dataPath)

    return {
      uri,
      path,
      profile: walletConfig.id,
      // FIXME: Default derivation method should be set somewhere in either agent config or some constants
      keyMethod: keyDerivationMethodToStoreKeyMethod(
        this.config.askarLibrary,
        walletConfig.keyDerivationMethod ?? KeyDerivationMethod.Argon2IMod
      ),
      passKey: walletConfig.key,
    }
  }
}
