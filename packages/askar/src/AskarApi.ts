import { AgentContext, injectable } from '@credo-ts/core'

import type { AskarStoreExportOptions, AskarStoreImportOptions, AskarStoreRotateKeyOptions } from './AskarApiOptions'
import { AskarModuleConfig } from './AskarModuleConfig'
import { AskarStoreManager } from './AskarStoreManager'

@injectable()
export class AskarApi {
  public constructor(
    private agentContext: AgentContext,
    private askarStoreManager: AskarStoreManager,
    public readonly config: AskarModuleConfig
  ) {}

  public get isStoreOpen() {
    return this.askarStoreManager.isStoreOpen(this.agentContext)
  }

  /**
   * @throws {AskarStoreDuplicateError} if the wallet already exists
   * @throws {AskarStoreError} if another error occurs
   */
  public async provisionStore(): Promise<void> {
    await this.askarStoreManager.provisionStore(this.agentContext)
  }

  /**
   * @throws {AskarStoreNotFoundError} if the wallet does not exist
   * @throws {AskarStoreError} if another error occurs
   */
  public async openStore(): Promise<void> {
    await this.askarStoreManager.openStore(this.agentContext)
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
  public async rotateStoreKey(options: AskarStoreRotateKeyOptions): Promise<void> {
    await this.askarStoreManager.rotateStoreKey(this.agentContext, options)
  }

  /**
   * Exports the current askar store.
   *
   * NOTE: a store can contain profiles for multiple tenants. When you export a store
   * all profiles will be exported with it.
   *
   * NOTE: store must be open before store can be expored
   */
  public async exportStore(options: AskarStoreExportOptions) {
    await this.askarStoreManager.exportStore(this.agentContext, options)
  }

  /**
   * Imports from an external store config into the current askar store config.
   *
   * NOTE: store must be closed first (using `closeStore`) before store can be imported
   */
  public async importStore(options: AskarStoreImportOptions) {
    await this.askarStoreManager.importStore(this.agentContext, options)
  }

  /**
   * Delete the current askar store.
   *
   * NOTE: multiple agent contexts (tenants) can use the same store. This method deletes the whole store.
   *
   *
   * @throws {AskarStoreNotFoundError} if the wallet does not exist
   * @throws {AskarStoreError} if another error occurs
   */
  public async deleteStore(): Promise<void> {
    await this.askarStoreManager.deleteStore(this.agentContext)
  }

  /**
   * Close the current askar store.
   *
   * This will close all sessions (also for tenants) in this store.
   */
  public async closeStore() {
    await this.askarStoreManager.closeStore(this.agentContext)
  }
}
