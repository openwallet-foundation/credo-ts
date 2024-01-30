import type { WalletConfig } from '@credo-ts/core'

import {
  WalletDuplicateError,
  WalletNotFoundError,
  InjectionSymbols,
  Logger,
  SigningProviderRegistry,
  WalletError,
} from '@credo-ts/core'
import { Store } from '@hyperledger/aries-askar-shared'
import { inject, injectable } from 'tsyringe'

import { AskarErrorCode, isAskarError } from '../utils'

import { AskarBaseWallet } from './AskarBaseWallet'

@injectable()
export class AskarProfileWallet extends AskarBaseWallet {
  private walletConfig?: WalletConfig
  public readonly store: Store

  public constructor(
    store: Store,
    @inject(InjectionSymbols.Logger) logger: Logger,
    signingKeyProviderRegistry: SigningProviderRegistry
  ) {
    super(logger, signingKeyProviderRegistry)

    this.store = store
  }

  public get isInitialized() {
    return this._session !== undefined
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
      if (isAskarError(error, AskarErrorCode.Duplicate)) {
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

      this._session = await this.store.session(walletConfig.id).open()

      // FIXME: opening a session for a profile that does not exist, will not throw an error until
      // the session is actually used. We can check if the profile exists by doing something with
      // the session, which will throw a not found error if the profile does not exists,
      // but that is not very efficient as it needs to be done on every open.
      // See: https://github.com/hyperledger/aries-askar/issues/163
      await this._session.fetch({
        category: 'fetch-to-see-if-profile-exists',
        name: 'fetch-to-see-if-profile-exists',
        forUpdate: false,
        isJson: false,
      })
    } catch (error) {
      // Profile does not exist
      if (isAskarError(error, AskarErrorCode.NotFound)) {
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

    this.logger.info(`Deleting profile '${this.walletConfig.id}'`)

    if (this._session) {
      await this.close()
    }

    try {
      await this.store.removeProfile(this.walletConfig.id)
    } catch (error) {
      const errorMessage = `Error deleting wallet for profile '${this.walletConfig.id}': ${error.message}`
      this.logger.error(errorMessage, {
        error,
        errorMessage: error.message,
      })

      throw new WalletError(errorMessage, { cause: error })
    }
  }

  public async export() {
    // This PR should help with this: https://github.com/hyperledger/aries-askar/pull/159
    throw new WalletError('Exporting a profile is not supported.')
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

    if (!this._session) {
      throw new WalletError('Wallet is in invalid state, you are trying to close wallet that has no handle.')
    }

    try {
      await this.session.close()
      this._session = undefined
    } catch (error) {
      const errorMessage = `Error closing wallet for profile ${this.walletConfig?.id}: ${error.message}`
      this.logger.error(errorMessage, {
        error,
        errorMessage: error.message,
      })

      throw new WalletError(errorMessage, { cause: error })
    }
  }
}
