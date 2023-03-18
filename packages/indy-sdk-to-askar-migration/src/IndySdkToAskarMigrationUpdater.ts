import type { AnonCredsCredentialValue } from '@aries-framework/anoncreds'
import type { Agent, FileSystem, WalletConfig } from '@aries-framework/core'
import type { EntryObject } from '@hyperledger/aries-askar-shared'

import { AnonCredsCredentialRecord, AnonCredsLinkSecretRecord } from '@aries-framework/anoncreds'
import { AskarWallet } from '@aries-framework/askar'
import { InjectionSymbols, KeyDerivationMethod, JsonTransformer, TypedArrayEncoder } from '@aries-framework/core'
import { Migration, Key, KeyAlgs, Store, StoreKeyMethod } from '@hyperledger/aries-askar-shared'

import { IndySdkToAskarMigrationError } from './errors/IndySdkToAskarMigrationError'
import { transformFromRecordTagValues } from './utils'

/**
 *
 * Migration class to move a wallet form the indy-sdk structure to the new
 * askar wallet structure.
 *
 * Right now, this is ONLY supported within React Native environments AND only sqlite.
 *
 * The reason it only works within React Native is that we ONLY update the
 * keys, masterSecret and credentials for now. If you have an agent in Node.JS
 * where it only contains these records, it may be used but we cannot
 * guarantee a successful migration.
 *
 */
export class IndySdkToAskarMigrationUpdater {
  private store?: Store
  private walletConfig: WalletConfig
  private defaultLinkSecretId: string
  private agent: Agent
  private dbPath: string
  private fs: FileSystem
  private deleteOnFinish: boolean

  private constructor(
    walletConfig: WalletConfig,
    agent: Agent,
    dbPath: string,
    deleteOnFinish = false,
    defaultLinkSecretId?: string
  ) {
    this.walletConfig = walletConfig
    this.dbPath = dbPath
    this.agent = agent
    this.fs = this.agent.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)
    this.defaultLinkSecretId = defaultLinkSecretId ?? walletConfig.id
    this.deleteOnFinish = deleteOnFinish
  }

  public static async initialize({
    dbPath,
    agent,
    deleteOnFinish,
    defaultLinkSecretId,
  }: {
    dbPath: string
    agent: Agent
    deleteOnFinish?: boolean
    defaultLinkSecretId?: string
  }) {
    const {
      config: { walletConfig },
    } = agent
    if (typeof process?.versions?.node !== 'undefined') {
      agent.config.logger.warn(
        'Node.JS is not fully supported. Using this will likely leave the wallet in a half-migrated state'
      )
    }

    if (!walletConfig) {
      throw new IndySdkToAskarMigrationError('Wallet config is required for updating the wallet')
    }

    if (walletConfig.storage && walletConfig.storage.type !== 'sqlite') {
      throw new IndySdkToAskarMigrationError('Only sqlite wallets are supported, right now')
    }

    if (agent.isInitialized) {
      throw new IndySdkToAskarMigrationError('Wallet migration can not be done on an initialized agent')
    }

    if (!(agent.dependencyManager.resolve(InjectionSymbols.Wallet) instanceof AskarWallet)) {
      throw new IndySdkToAskarMigrationError("Wallet on the agent must be of instance 'AskarWallet'")
    }

    return new IndySdkToAskarMigrationUpdater(walletConfig, agent, dbPath, deleteOnFinish, defaultLinkSecretId)
  }

  /**
   * This function migrates the old database to the new structure.
   *
   * This doubles checks some fields as later it might be possiblt to run this function
   */
  private async migrate() {
    const specUri = this.dbPath
    const kdfLevel = this.walletConfig.keyDerivationMethod ?? 'ARGON2I_MOD'
    const walletName = this.walletConfig.id
    const walletKey = this.walletConfig.key
    const storageType = this.walletConfig.storage?.type ?? 'sqlite'

    if (storageType !== 'sqlite') {
      throw new IndySdkToAskarMigrationError("Storage type defined and not of type 'sqlite'")
    }

    if (!walletKey) {
      throw new IndySdkToAskarMigrationError('Wallet key is not defined in the wallet configuration')
    }

    this.agent.config.logger.info('Migration indy-sdk database structure to askar')
    await Migration.migrate({ specUri, walletKey, kdfLevel, walletName })
  }

  /*
   * Checks whether the destination locations are allready used. This might
   * happen if you want to migrate a wallet when you already have a new wallet
   * with the same id.
   */
  private async assertDestinationsAreFree() {
    const areAllDestinationsTaken =
      (await this.fs.exists(this.backupFile)) || (await this.fs.exists(this.newWalletPath))

    if (areAllDestinationsTaken) {
      throw new IndySdkToAskarMigrationError(
        `Files already exist at paths that will be used for backing up. Please remove them manually. Backup path: '${this.backupFile}' and new wallet path: ${this.newWalletPath} `
      )
    }
  }

  /**
   * Location of the new wallet
   */
  private get newWalletPath() {
    return `${this.fs.dataPath}/wallet/${this.walletConfig.id}/sqlite.db`
  }

  /**
   * Temporary backup location of the pre-migrated script
   */
  private get backupFile() {
    return `${this.fs.tempPath}/${this.walletConfig.id}.bak.db`
  }

  /**
   * Backup the database file. This function makes sure that the the indy-sdk
   * database file is backed up within our temporary directory path. If some
   * error occurs, `this.revertDatbase()` will be called to revert the backup.
   */
  private async backupDatabase() {
    const src = this.dbPath
    const dest = this.backupFile
    this.agent.config.logger.trace(`Creating backup from '${src}' to '${dest}'`)

    // Create the directories for the backup
    await this.fs.createDirectory(dest)

    // Copy the supplied database to the backup destination
    await this.fs.copyFile(src, dest)

    if (!(await this.fs.exists(dest))) {
      throw new IndySdkToAskarMigrationError('Could not locate the new backup file')
    }
  }

  /**
   * Reverts backed up database file to the original path, if its missing, and
   * deletes the backup. We do some additional, possible redundant, exists checks
   * here to be extra sure that only a happy flow occurs.
   */
  private async restoreDatabase() {
    // "Impossible" state. Since we do not continue if `this.backupDatabase()`
    // fails, this file should always be there. If this error is thrown, we
    // cannot correctly restore the state.
    if (!(await this.fs.exists(this.backupFile))) {
      throw new IndySdkToAskarMigrationError('Backup file could not be found while trying to restore the state')
    }

    /**
     * Since we used `copy` to get the file, it should still be there. We
     * double-check here to be sure.
     */
    if (!(await this.fs.exists(this.dbPath))) {
      return
    } else {
      this.agent.config.logger.trace(`Moving '${this.backupFile}' back to the original path: '${this.dbPath}`)

      // Move the backedup file back to the original path
      await this.fs.copyFile(this.backupFile, this.dbPath)

      this.agent.config.logger.trace(`Cleaned up the backed up file at '${this.backupFile}'`)
    }
  }

  // Delete the backup as `this.fs.copyFile` only copies and no deletion
  // Since we use `tempPath` which is cleared when certain events happen,
  // e.g. cron-job and system restart (depending on the os) we could omit
  // this call `await this.fs.delete(this.backupFile)`.
  private async cleanBackup() {
    this.agent.config.logger.trace(`Deleting the backup file at '${this.backupFile}'`)
    await this.fs.delete(this.backupFile)
  }

  /**
   * Move the migrated and updated database file to the new location according
   * to the `FileSystem.dataPath`.
   */
  private async moveToNewLocation() {
    const src = this.dbPath
    // New path for the database
    const dest = this.newWalletPath

    // create the wallet directory
    await this.fs.createDirectory(dest)

    this.agent.config.logger.trace(`Moving upgraded database from ${src} to ${dest}`)

    // Copy the file from the database path to the new location
    await this.fs.copyFile(src, dest)

    // Delete the original, only if specified by the user
    if (this.deleteOnFinish) await this.fs.delete(this.dbPath)
  }

  /**
   * Function that updates the values from an indy-sdk structure to the new askar structure.
   *
   * - Assert that the paths that will be used are free
   * - Create a backup of the database
   * - Migrate the database to askar structure
   * - Update the Keys
   * - Update the Master Secret (Link Secret)
   * - Update the credentials
   * If any of those failed:
   *   - Revert the database
   * - Clear the backup from the temporary directory
   */
  public async update() {
    await this.assertDestinationsAreFree()

    await this.backupDatabase()
    try {
      // Migrate the database
      await this.migrate()

      const keyMethod =
        this.walletConfig?.keyDerivationMethod == KeyDerivationMethod.Raw ? StoreKeyMethod.Raw : StoreKeyMethod.Kdf
      this.store = await Store.open({ uri: `sqlite://${this.dbPath}`, passKey: this.walletConfig.key, keyMethod })

      // Update the values to reflect the new structure
      await this.updateKeys()
      await this.updateCredentialDefinitions()
      await this.updateMasterSecret()
      await this.updateCredentials()

      // Move the migrated and updated file to the expected location for afj
      await this.moveToNewLocation()
    } catch (err) {
      this.agent.config.logger.error('Migration failed. Restoring state.')

      await this.restoreDatabase()

      throw new IndySdkToAskarMigrationError(`Migration failed. State has been restored. ${err.message}`, {
        cause: err.cause,
      })
    } finally {
      await this.cleanBackup()
    }
  }

  private async updateKeys() {
    if (!this.store) {
      throw new IndySdkToAskarMigrationError('Update keys can not be called outside of the `update()` function')
    }

    const category = 'Indy::Key'

    this.agent.config.logger.info(`Migrating category: ${category}`)

    let updateCount = 0
    const session = this.store.transaction()
    for (;;) {
      const txn = await session.open()
      const keys = await txn.fetchAll({ category, limit: 50 })
      if (!keys || keys.length === 0) {
        await txn.close()
        break
      }

      for (const row of keys) {
        this.agent.config.logger.debug(`Migrating ${row.name} to the new askar format`)
        const signKey: string = JSON.parse(row.value as string).signkey
        const keySk = TypedArrayEncoder.fromBase58(signKey)
        const key = Key.fromSecretBytes({
          algorithm: KeyAlgs.Ed25519,
          secretKey: keySk.subarray(0, 32),
        })
        await txn.insertKey({ name: row.name, key })

        await txn.remove({ category, name: row.name })
        key.handle.free()
        updateCount++
      }
      await txn.commit()
    }

    this.agent.config.logger.info(`Migrated ${updateCount} records of type ${category}`)
  }

  private async updateCredentialDefinitions() {
    if (!this.store) {
      throw new IndySdkToAskarMigrationError('Update keys can not be called outside of the `update()` function')
    }

    const category = 'Indy::CredentialDefinition'

    this.agent.config.logger.info(`Migrating category: ${category}`)

    const session = this.store.transaction()
    for (;;) {
      const txn = await session.open()
      const keys = await txn.fetchAll({ category, limit: 50 })
      if (!keys || keys.length === 0) {
        await txn.close()
        break
      } else {
        // This will be entered if there are credential definitions in the wallet
        await txn.close()
        throw new IndySdkToAskarMigrationError('Migration of Credential Definitions is not yet supported')
      }
    }
  }

  private async updateMasterSecret() {
    if (!this.store) {
      throw new IndySdkToAskarMigrationError(
        'Update master secret can not be called outside of the `update()` function'
      )
    }

    const category = 'Indy::MasterSecret'

    this.agent.config.logger.info(`Migrating category: ${category}`)

    let updateCount = 0
    const session = this.store.transaction()

    for (;;) {
      const txn = await session.open()
      const masterSecrets = await txn.fetchAll({ category, limit: 50 })
      if (!masterSecrets || masterSecrets.length === 0) {
        await txn.close()
        break
      }

      if (!masterSecrets.some((ms: EntryObject) => ms.name === this.defaultLinkSecretId)) {
        throw new IndySdkToAskarMigrationError('defaultLinkSecretId can not be established.')
      }

      this.agent.config.logger.info(`Default link secret id for migration is ${this.defaultLinkSecretId}`)

      for (const row of masterSecrets) {
        this.agent.config.logger.debug(`Migrating ${row.name} to the new askar format`)

        const isDefault = masterSecrets.length === 0 ?? row.name === this.walletConfig.id

        const {
          value: { ms },
        } = JSON.parse(row.value as string) as { value: { ms: string } }

        const record = new AnonCredsLinkSecretRecord({ linkSecretId: row.name, value: ms })
        record.setTag('isDefault', isDefault)
        const value = JsonTransformer.serialize(record)

        const tags = transformFromRecordTagValues(record.getTags())

        await txn.insert({ category: record.type, name: record.id, value, tags })

        await txn.remove({ category, name: row.name })
        updateCount++
      }
      await txn.commit()
    }

    this.agent.config.logger.info(`Migrated ${updateCount} records of type ${category}`)
  }

  private async updateCredentials() {
    if (!this.store) {
      throw new IndySdkToAskarMigrationError('Update credentials can not be called outside of the `update()` function')
    }

    const category = 'Indy::Credential'

    this.agent.config.logger.info(`Migrating category: ${category}`)

    let updateCount = 0
    const session = this.store.transaction()
    for (;;) {
      const txn = await session.open()
      const credentials = await txn.fetchAll({ category, limit: 50 })
      if (!credentials || credentials.length === 0) {
        await txn.close()
        break
      }

      for (const row of credentials) {
        this.agent.config.logger.debug(`Migrating ${row.name} to the new askar format`)
        const data = JSON.parse(row.value as string) as {
          schema_id: string
          cred_def_id: string
          rev_reg_id?: string
          values: Record<string, AnonCredsCredentialValue>
          signature: Record<string, unknown>
          signature_correctness_proof: Record<string, unknown>
          rev_reg?: Record<string, unknown>
          witness?: Record<string, unknown>
        }
        const [issuerId] = data.cred_def_id.split(':')
        const [schemaIssuerId, , schemaName, schemaVersion] = data.schema_id.split(':')

        const record = new AnonCredsCredentialRecord({
          credential: data,
          issuerId,
          schemaName,
          schemaIssuerId,
          schemaVersion,
          credentialId: row.name,
          linkSecretId: this.defaultLinkSecretId,
          // Hardcode methodName to indy as all IndySDK credentials are indy credentials
          methodName: 'indy',
        })

        const tags = transformFromRecordTagValues(record.getTags())
        const value = JsonTransformer.serialize(record)

        await txn.insert({ category: record.type, name: record.id, value, tags })

        await txn.remove({ category, name: row.name })
        updateCount++
      }
      await txn.commit()
    }

    this.agent.config.logger.info(`Migrated ${updateCount} records of type ${category}`)
  }
}
