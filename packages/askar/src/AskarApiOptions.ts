import type { AskarModuleConfigStoreOptions } from './AskarModuleConfig'

export interface AskarStoreExportOptions {
  /**
   * The store config to export the current store to.
   */
  exportToStore: AskarModuleConfigStoreOptions
}

export interface AskarStoreImportOptions {
  /**
   * The store config to import the current store from.
   */
  importFromStore: AskarModuleConfigStoreOptions
}

export interface AskarStoreRotateKeyOptions {
  /**
   * The new key to use for the store.
   */
  newKey: string

  /**
   * The new key derivation method to use for the store. If not provided the
   * key derivation method from the current store config will be used.
   */
  newKeyDerivationMethod?: AskarModuleConfigStoreOptions['keyDerivationMethod']
}
