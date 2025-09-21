import type { WalletConfig } from '@credo-ts/core'

import {
  WalletExportUnsupportedError,
  WalletDuplicateError,
  WalletNotFoundError,
  InjectionSymbols,
  Logger,
  SigningProviderRegistry,
  WalletError,
} from '@credo-ts/core'
import { inject, injectable } from 'tsyringe'

import { AskarModuleConfig } from '../AskarModuleConfig'
import { AskarErrorCode, isAskarError } from '../utils'
import { AskarStoreSymbol, Store } from '../utils/importAskar'

import { AskarBaseWallet } from './AskarBaseWallet'

@injectable()
export class AskarProfileWallet extends AskarBaseWallet {
  private walletConfig?: WalletConfig
  public readonly store: Store
  public isInitialized = false

  public constructor(
    @inject(AskarStoreSymbol) store: Store,
    @inject(InjectionSymbols.Logger) logger: Logger,
    signingKeyProviderRegistry: SigningProviderRegistry,
    config: AskarModuleConfig
  ) {
    super(logger, signingKeyProviderRegistry, config)

    this.store = store
  }

  public get isProvisioned() {
    return this.walletConfig !== undefined
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

  public async create(walletConfig: WalletConfig): Promise<void> {
    this.logger.debug(`Creating wallet for profile '${walletConfig.id}'`)

    try {
      await this.store.createProfile(walletConfig.id)
    } catch (error) {
      if (isAskarError(this.config.askarLibrary, error, AskarErrorCode.Duplicate)) {
        const errorMessage = `Wallet for profile '${walletConfig.id}' already exists`
        this.logger.debug(errorMessage)

        throw new WalletDuplicateError(errorMessage, {
          walletType: 'AskarProfileWallet',
          cause: error,
        })
      }

      const errorMessage = `Error creating wallet for profile '${walletConfig.id}'`
      this.logger.error(errorMessage, {
        error,
        errorMessage: error.message,
      })

      throw new WalletError(errorMessage, { cause: error })
    }

    this.logger.debug(`Successfully created wallet for profile '${walletConfig.id}'`)
  }

  public async open(walletConfig: WalletConfig): Promise<void> {
    this.logger.debug(`Opening wallet for profile '${walletConfig.id}'`)

    try {
      this.walletConfig = walletConfig

      // TODO: what is faster? listProfiles or open and close session?
      // I think open/close is more scalable (what if profiles is 10.000.000?)
      // We just want to check if the profile exists. Because the wallet initialization logic
      // first tries to open, and if it doesn't exist it will create it. So we must check here
      // if the profile exists
      await this.withSession(() => {
        /* no-op */
      })
      this.isInitialized = true
    } catch (error) {
      // Profile does not exist
      if (isAskarError(this.config.askarLibrary, error, AskarErrorCode.NotFound)) {
        const errorMessage = `Wallet for profile '${walletConfig.id}' not found`
        this.logger.debug(errorMessage)

        throw new WalletNotFoundError(errorMessage, {
          walletType: 'AskarProfileWallet',
          cause: error,
        })
      }

      const errorMessage = `Error opening wallet for profile '${walletConfig.id}'`
      this.logger.error(errorMessage, {
        error,
        errorMessage: error.message,
      })

      throw new WalletError(errorMessage, { cause: error })
    }

    this.logger.debug(`Successfully opened wallet for profile '${walletConfig.id}'`)
  }

  public async createAndOpen(walletConfig: WalletConfig): Promise<void> {
    await this.create(walletConfig)
    await this.open(walletConfig)
  }

  public async delete() {
    if (!this.walletConfig) {
      throw new WalletError(
        'Can not delete wallet that does not have wallet config set. Make sure to call create wallet before deleting the wallet'
      )
    }

    this.logger.info(`Deleting profile '${this.profile}'`)
    if (this.isInitialized) {
      await this.close()
    }

    try {
      await this.store.removeProfile(this.profile)
    } catch (error) {
      const errorMessage = `Error deleting wallet for profile '${this.profile}': ${error.message}`
      this.logger.error(errorMessage, {
        error,
        errorMessage: error.message,
      })

      throw new WalletError(errorMessage, { cause: error })
    }
  }

  public async export() {
    // This PR should help with this: https://github.com/hyperledger/aries-askar/pull/159
    throw new WalletExportUnsupportedError('Exporting a profile is not supported.')
  }

  public async import() {
    // This PR should help with this: https://github.com/hyperledger/aries-askar/pull/159
    throw new WalletError('Importing a profile is not supported.')
  }

  public async rotateKey(): Promise<void> {
    throw new WalletError(
      'Rotating a key is not supported for a profile. You can rotate the key on the main askar wallet.'
    )
  }

  public async close() {
    this.logger.debug(`Closing wallet for profile ${this.walletConfig?.id}`)

    if (!this.isInitialized) {
      throw new WalletError('Wallet is in invalid state, you are trying to close wallet that is not initialized.')
    }

    this.isInitialized = false
  }
}
