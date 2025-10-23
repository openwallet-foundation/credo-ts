import { AgentContext, type FileSystem, InjectionSymbols, JsonTransformer, StorageVersionRecord } from '@credo-ts/core'
import { KdfMethod, Session, Store, StoreKeyMethod } from '@openwallet-foundation/askar-shared'
import { inject, injectable } from 'tsyringe'

import type { AskarStoreExportOptions, AskarStoreImportOptions, AskarStoreRotateKeyOptions } from './AskarApiOptions'
import {
  AskarModuleConfig,
  type AskarModuleConfigStoreOptions,
  AskarMultiWalletDatabaseScheme,
} from './AskarModuleConfig'
import {
  AskarError,
  AskarStoreDuplicateError,
  AskarStoreError,
  AskarStoreExportPathExistsError,
  AskarStoreImportPathExistsError,
  AskarStoreInvalidKeyError,
  AskarStoreNotFoundError,
} from './error'
import { transformFromRecordTagValues } from './storage/utils'
import { getAskarStoreConfigForContextCorrelationId } from './tenants'
import {
  AskarErrorCode,
  isAskarError,
  isSqliteInMemoryUri,
  keyDerivationMethodFromStoreConfig,
  uriFromStoreConfig,
} from './utils'

@injectable()
export class AskarStoreManager {
  public constructor(
    @inject(InjectionSymbols.FileSystem) private fileSystem: FileSystem,
    private config: AskarModuleConfig
  ) {}

  public isStoreOpen(agentContext: AgentContext) {
    return !!this.getStore(agentContext)?.handle
  }

  private async getStoreConfig(agentContext: AgentContext): Promise<AskarModuleConfigStoreOptions> {
    if (
      agentContext.isRootAgentContext ||
      this.config.multiWalletDatabaseScheme === AskarMultiWalletDatabaseScheme.ProfilePerWallet
    ) {
      return this.config.store
    }

    // Otherwise we need to get the wallet key from the tenant record
    const storeConfig = await getAskarStoreConfigForContextCorrelationId(agentContext)

    return {
      id: agentContext.contextCorrelationId,
      key: storeConfig.key,
      // we always use raw at the moment
      keyDerivationMethod: 'raw',
      database: this.config.store.database,
    }
  }

  /**
   * When we create storage for a context we need to store the version record
   */
  private async setCurrentFrameworkStorageVersionOnSession(session: Session) {
    const record = new StorageVersionRecord({
      storageVersion: StorageVersionRecord.frameworkStorageVersion,
    })

    await session.insert({
      value: JsonTransformer.serialize(record),
      name: record.id,
      category: record.type,
      tags: transformFromRecordTagValues(record.getTags()),
    })
  }

  /**
   * Deletes all storage related to a context. If on store level, meaning root agent
   * or when using database per wallet storage, the whole store will be deleted.
   * Otherwise only a profile within the store will be removed.
   */
  public async deleteContext(agentContext: AgentContext) {
    const { profile, store } = await this.getInitializedStoreWithProfile(agentContext)
    // Currently it will delete the whole store. We can delete only the root profile, BUT:
    // - all tenant records will be deleted
    // - the root agent is deleted, this is not a flow we support (there's no default profile anymore)
    if (this.isStoreLevel(agentContext)) {
      await this.deleteStore(agentContext)
    } else {
      if (!profile)
        throw new AskarStoreError(
          'Unable to delete asksar data for context. No profile found and not on store level (so not deleting the whole store)'
        )

      await store.removeProfile(profile)
    }
  }

  /**
   * Closes an active context. If on store level, meaning root agent
   * or when using database per wallet storage, the whole store will be closed.
   * Otherwise nothing will be done as profiles are opened on a store from higher level.
   */
  public async closeContext(agentContext: AgentContext) {
    // TODO: we should maybe set some value on the agentContext indicating it is disposed so no new sessions can be opened
    // If not on store level we don't have to do anything.
    if (!this.isStoreLevel(agentContext)) return

    await this.closeStore(agentContext)
  }

  /**
   * @throws {AskarStoreDuplicateError} if the wallet already exists
   * @throws {AskarStoreError} if another error occurs
   */
  public async provisionStore(agentContext: AgentContext): Promise<Store> {
    this.ensureStoreLevel(agentContext)

    const storeConfig = await this.getStoreConfig(agentContext)
    const askarStoreConfig = this.getAskarStoreConfig(storeConfig)

    agentContext.config.logger.debug(`Provisioning store '${storeConfig.id}`)

    if (this.getStore(agentContext)) {
      throw new AskarStoreError('Store already provisioned')
    }

    try {
      if (askarStoreConfig.path) {
        if (await this.fileSystem.exists(askarStoreConfig.path)) {
          throw new AskarStoreDuplicateError(
            `Store '${storeConfig.id}' at path ${askarStoreConfig.path} already exists.`
          )
        }

        // Make sure path exists before creating the wallet
        await this.fileSystem.createDirectory(askarStoreConfig.path)
      }

      const store = await Store.provision({
        recreate: false,
        uri: askarStoreConfig.uri,
        profile: askarStoreConfig.profile,
        keyMethod: askarStoreConfig.keyMethod,
        passKey: askarStoreConfig.passKey,
      })
      agentContext.dependencyManager.registerInstance(Store, store)

      // For new stores we need to set the framework storage version
      await this.withSession(agentContext, (session) => this.setCurrentFrameworkStorageVersionOnSession(session))

      return store
    } catch (error) {
      if (error instanceof AskarStoreDuplicateError) throw error

      // FIXME: Askar should throw a Duplicate error code, but is currently returning Encryption
      // And if we provide the very same wallet key, it will open it without any error
      if (
        isAskarError(error) &&
        (error.code === AskarErrorCode.Encryption || error.code === AskarErrorCode.Duplicate)
      ) {
        const errorMessage = `Store '${storeConfig.id}' already exists`
        agentContext.config.logger.debug(errorMessage)

        throw new AskarStoreDuplicateError(errorMessage, {
          cause: error,
        })
      }

      const errorMessage = `Error creating store '${storeConfig.id}'`
      agentContext.config.logger.error(errorMessage, {
        error,
        errorMessage: error.message,
      })

      throw new AskarStoreError(errorMessage, { cause: error })
    }
  }

  /**
   * @throws {AskarStoreNotFoundError} if the wallet does not exist
   * @throws {AskarStoreError} if another error occurs
   */
  public async openStore(agentContext: AgentContext): Promise<Store> {
    this.ensureStoreLevel(agentContext)

    if (this.getStore(agentContext)) {
      throw new AskarStoreError('Store already opened. Close the currently opened store before re-opening the store')
    }

    const storeConfig = await this.getStoreConfig(agentContext)
    const askarStoreConfig = this.getAskarStoreConfig(storeConfig)

    try {
      const store = await Store.open({
        uri: askarStoreConfig.uri,
        keyMethod: askarStoreConfig.keyMethod,
        passKey: askarStoreConfig.passKey,
      })
      agentContext.dependencyManager.registerInstance(Store, store)
      return store
    } catch (error) {
      if (
        isAskarError(error) &&
        (error.code === AskarErrorCode.NotFound ||
          (error.code === AskarErrorCode.Backend && isSqliteInMemoryUri(askarStoreConfig.uri)))
      ) {
        const errorMessage = `Store '${storeConfig.id}' not found`
        agentContext.config.logger.debug(errorMessage)

        throw new AskarStoreNotFoundError(errorMessage, {
          cause: error,
        })
      }

      if (isAskarError(error) && error.code === AskarErrorCode.Encryption) {
        const errorMessage = `Incorrect key for store '${storeConfig.id}'`
        agentContext.config.logger.debug(errorMessage)
        throw new AskarStoreInvalidKeyError(errorMessage, {
          cause: error,
        })
      }
      throw new AskarStoreError(`Error opening store ${storeConfig.id}: ${error.message}`, { cause: error })
    }
  }

  /**
   * Rotate the key of the current askar store.
   *
   * NOTE: multiple agent contexts (tenants) can use the same store. This method rotates the key for the whole store,
   * it is advised to only run this method on the root tenant agent when using profile per wallet database strategy.
   * After running this method you should change the store configuration in the Askar module.
   *
   * @throws {AskarStoreNotFoundError} if the wallet does not exist
   * @throws {AskarStoreError} if another error occurs
   */
  public async rotateStoreKey(agentContext: AgentContext, options: AskarStoreRotateKeyOptions): Promise<void> {
    this.ensureStoreLevel(agentContext)

    const store = this.getStore(agentContext)
    if (!store) {
      throw new AskarStoreError('Store needs to be open to rotate the wallet key')
    }

    const storeConfig = await this.getStoreConfig(agentContext)

    try {
      await store.rekey({
        passKey: options.newKey,
        keyMethod: keyDerivationMethodFromStoreConfig(
          options.newKeyDerivationMethod ?? storeConfig.keyDerivationMethod
        ),
      })
    } catch (error) {
      const errorMessage = `Error rotating key for store '${storeConfig.id}': ${error.message}`
      agentContext.config.logger.error(errorMessage, {
        error,
        errorMessage: error.message,
      })

      throw new AskarStoreError(errorMessage, { cause: error })
    }
  }

  /**
   * Exports the current askar store.
   *
   * NOTE: a store can contain profiles for multiple tenants. When you export a store
   * all profiles will be exported with it.
   */
  public async exportStore(agentContext: AgentContext, options: AskarStoreExportOptions) {
    this.ensureStoreLevel(agentContext)

    const store = this.getStore(agentContext)
    if (!store) {
      throw new AskarStoreError('Unable to export store. No store available on agent context')
    }

    const currentStoreConfig = await this.getStoreConfig(agentContext)
    try {
      const newAskarStoreConfig = this.getAskarStoreConfig(options.exportToStore)

      // If path based store, ensure path does not exist yet, and create new store path
      if (newAskarStoreConfig.path) {
        // Export path already exists
        if (await this.fileSystem.exists(newAskarStoreConfig.path)) {
          throw new AskarStoreExportPathExistsError(
            `Unable to create export, wallet export at path '${newAskarStoreConfig.path}' already exists`
          )
        }

        // Make sure destination path exists
        await this.fileSystem.createDirectory(newAskarStoreConfig.path)
      }

      await store.copyTo({
        recreate: false,
        uri: newAskarStoreConfig.uri,
        keyMethod: newAskarStoreConfig.keyMethod,
        passKey: newAskarStoreConfig.passKey,
      })
    } catch (error) {
      const errorMessage = `Error exporting store '${currentStoreConfig.id}': ${error.message}`
      agentContext.config.logger.error(errorMessage, {
        error,
        errorMessage: error.message,
      })

      if (error instanceof AskarStoreExportPathExistsError) throw error
      throw new AskarStoreError(errorMessage, { cause: error })
    }
  }

  /**
   * Imports from an external store config into the current askar store config.
   */
  public async importStore(agentContext: AgentContext, options: AskarStoreImportOptions) {
    this.ensureStoreLevel(agentContext)

    if (this.getStore(agentContext)) {
      throw new AskarStoreError('To import a store the current store needs to be closed first')
    }

    const destinationStoreConfig = await this.getStoreConfig(agentContext)

    const sourceAskarStoreConfig = this.getAskarStoreConfig(options.importFromStore)
    const destinationAskarStoreConfig = this.getAskarStoreConfig(destinationStoreConfig)

    let sourceWalletStore: Store | undefined
    try {
      if (destinationAskarStoreConfig.path) {
        // Import path already exists
        if (await this.fileSystem.exists(destinationAskarStoreConfig.path)) {
          throw new AskarStoreImportPathExistsError(
            `Unable to import store. Path '${destinationAskarStoreConfig.path}' already exists`
          )
        }

        await this.fileSystem.createDirectory(destinationAskarStoreConfig.path)
      }

      // Open imported wallet and copy to destination
      sourceWalletStore = await Store.open({
        uri: sourceAskarStoreConfig.uri,
        keyMethod: sourceAskarStoreConfig.keyMethod,
        passKey: sourceAskarStoreConfig.passKey,
      })

      await sourceWalletStore.copyTo({
        recreate: false,
        uri: destinationAskarStoreConfig.uri,
        keyMethod: destinationAskarStoreConfig.keyMethod,
        passKey: destinationAskarStoreConfig.passKey,
      })

      await sourceWalletStore.close()
    } catch (error) {
      await sourceWalletStore?.close()
      const errorMessage = `Error importing store '${options.importFromStore.id}': ${error.message}`
      agentContext.config.logger.error(errorMessage, {
        error,
        errorMessage: error.message,
      })

      if (error instanceof AskarStoreImportPathExistsError) throw error

      // Cleanup any wallet file we could have created
      if (destinationAskarStoreConfig.path && (await this.fileSystem.exists(destinationAskarStoreConfig.path))) {
        await this.fileSystem.delete(destinationAskarStoreConfig.path)
      }

      throw new AskarStoreError(errorMessage, { cause: error })
    }
  }

  /**
   * Delete the current askar store.
   *
   * NOTE: multiple agent contexts (tenants) can use the same store. This method deletes the whole store,
   * and if you're using multi-tenancy with profile per wallet it is advised to only run this method on the root tenant agent.
   *
   * @throws {AskarStoreNotFoundError} if the wallet does not exist
   * @throws {AskarStoreError} if another error occurs
   */
  public async deleteStore(agentContext: AgentContext): Promise<void> {
    this.ensureStoreLevel(agentContext)

    if (this.getStore(agentContext)) {
      await this.closeStore(agentContext)
    }

    const storeConfig = await this.getStoreConfig(agentContext)
    const askarStoreConfig = this.getAskarStoreConfig(storeConfig)

    agentContext.config.logger.info(`Deleting store '${storeConfig.id}'`)
    try {
      await Store.remove(askarStoreConfig.uri)
      // Clear the store instance
      agentContext.dependencyManager.registerInstance(Store, undefined)
    } catch (error) {
      const errorMessage = `Error deleting store '${storeConfig.id}': ${error.message}`
      agentContext.config.logger.error(errorMessage, {
        error,
        errorMessage: error.message,
      })

      throw new AskarStoreError(errorMessage, { cause: error })
    }
  }

  /**
   * Close the current askar store
   */
  public async closeStore(agentContext: AgentContext) {
    this.ensureStoreLevel(agentContext)

    const store = this.getStore(agentContext)
    if (!store) {
      throw new AskarStoreError('There is no open store.')
    }

    const storeConfig = await this.getStoreConfig(agentContext)

    try {
      agentContext.config.logger.debug(`Closing store '${storeConfig.id}'`)
      await store.close()
      // Unregister the store from the context
      agentContext.dependencyManager.registerInstance(Store, undefined)
    } catch (error) {
      const errorMessage = `Error closing store '${storeConfig.id}': ${error.message}`
      agentContext.config.logger.error(errorMessage, {
        error,
        errorMessage: error.message,
      })

      throw new AskarStoreError(errorMessage, { cause: error })
    }
  }

  private getAskarStoreConfig(storeConfig: AskarModuleConfigStoreOptions) {
    const { uri, path } = uriFromStoreConfig(storeConfig, this.fileSystem.dataPath)

    return {
      uri,
      path,
      profile: storeConfig.id,
      keyMethod: new StoreKeyMethod(
        (storeConfig.keyDerivationMethod ?? KdfMethod.Argon2IMod) satisfies `${KdfMethod}` | KdfMethod as KdfMethod
      ),
      passKey: storeConfig.key,
    }
  }

  /**
   * Run callback with a transaction. If the callback resolves the transaction
   * will be committed if the transaction is not closed yet. If the callback rejects
   * the transaction will be rolled back if the transaction is not closed yet.
   *
   * TODO: update to new `using` syntax so we don't have to use a callback
   */
  public async withTransaction<Return>(
    agentContext: AgentContext,
    callback: (session: Session) => Return
  ): Promise<Awaited<Return>> {
    return this._withSession(agentContext, callback, true)
  }

  /**
   * Run callback with the session provided, the session will
   * be closed once the callback resolves or rejects if it is not closed yet.
   *
   * TODO: update to new `using` syntax so we don't have to use a callback
   */
  public async withSession<Return>(
    agentContext: AgentContext,
    callback: (session: Session) => Return
  ): Promise<Awaited<Return>> {
    return this._withSession(agentContext, callback, false)
  }

  private getStore(agentContext: AgentContext, { recursive = false }: { recursive?: boolean } = {}) {
    const isRegistered = agentContext.dependencyManager.isRegistered(Store, recursive)
    if (!isRegistered) return null

    // We set the store value to undefined in the dependency manager
    // when closing it, but TSyringe still marks is as registered, but
    // will throw an error when resolved. Since there is no unregister method
    // we wrap it with a try-catch
    try {
      return agentContext.dependencyManager.resolve(Store)
    } catch {
      return null
    }
  }

  private async _withSession<Return>(
    agentContext: AgentContext,
    callback: (session: Session) => Return,
    transaction = false
  ): Promise<Awaited<Return>> {
    let session: Session | undefined
    try {
      const { store, profile } = await this.getInitializedStoreWithProfile(agentContext)

      session = await (transaction ? store.transaction(profile) : store.session(profile))
        .open()
        .catch(async (error) => {
          // If the profile does not exist yet we create it
          // TODO: do we want some guards around this? I think this is really the easist approach to
          // just create it if it doesn't exist yet.
          if (isAskarError(error, AskarErrorCode.NotFound) && profile) {
            await store.createProfile(profile)
            const session = await store.session(profile).open()

            try {
              // For new profiles we need to set the framework storage version
              await this.setCurrentFrameworkStorageVersionOnSession(session)
            } catch (error) {
              await session.close()
              throw error
            }

            return session
          }

          throw error
        })

      const result = await callback(session)
      if (transaction && session.handle) {
        await session.commit()
      }

      return result
    } catch (error) {
      agentContext.config.logger.error('Error occured during transaction, rollback', {
        error,
      })
      if (transaction && session?.handle) {
        await session.rollback()
      }
      throw error
    } finally {
      if (session?.handle) {
        await session.close()
      }
    }
  }

  public async getInitializedStoreWithProfile(agentContext: AgentContext) {
    let store = this.getStore(agentContext, {
      // In case we use a profile per wallet, we want to use the parent store, otherwise we only
      // want to use a store that is directly registered on this context.
      recursive: this.config.multiWalletDatabaseScheme === AskarMultiWalletDatabaseScheme.ProfilePerWallet,
    })

    if (!store) {
      try {
        store = await this.openStore(agentContext)
      } catch (error) {
        if (error instanceof AskarStoreNotFoundError) {
          store = await this.provisionStore(agentContext)
        } else {
          throw error
        }
      }
    }

    return {
      // If we're on store level the default profile can be used automatically
      // otherwise we need to set the profile, which we do based on the context correlation id
      profile: this.isStoreLevel(agentContext) ? undefined : agentContext.contextCorrelationId,
      store,
    }
  }

  /**
   * Ensures a command is ran on a store level, preventing a tenant instance from
   * removing a whole store (and potentially other tennats).
   */
  private ensureStoreLevel(agentContext: AgentContext) {
    if (this.isStoreLevel(agentContext)) return

    throw new AskarError(
      `Agent context ${agentContext.contextCorrelationId} is not on store level. Make sure to only perform askar store operations in the agent context managing the askar store`
    )
  }

  /**
   * Checks whether the current agent context is on store level
   */
  private isStoreLevel(agentContext: AgentContext) {
    if (agentContext.isRootAgentContext) return true
    return this.config.multiWalletDatabaseScheme === AskarMultiWalletDatabaseScheme.DatabasePerWallet
  }
}
