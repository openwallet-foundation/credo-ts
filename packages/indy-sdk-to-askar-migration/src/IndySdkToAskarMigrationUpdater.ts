import type { AnonCredsCredentialValue } from '@aries-framework/anoncreds'
import type { Agent, FileSystem } from '@aries-framework/core'
import type { EntryObject } from '@hyperledger/aries-askar-shared'

import { AnonCredsCredentialRecord, AnonCredsLinkSecretRecord } from '@aries-framework/anoncreds'
import { InjectionSymbols, KeyDerivationMethod, JsonTransformer, TypedArrayEncoder } from '@aries-framework/core'
import { Key, KeyAlgs, Store, StoreKeyMethod } from '@hyperledger/aries-askar-shared'

import { IndySdkToAskarMigrationError } from './errors/IndySdkToAskarMigrationError'
import { transformFromRecordTagValues } from './utils'

export class IndySdkToAskarMigrationUpdater {
  private store: Store
  private walletName: string
  private defaultLinkSecretId: string
  private agent: Agent

  private constructor(store: Store, walletName: string, agent: Agent, defaultLinkSecretId?: string) {
    this.store = store
    this.walletName = walletName
    this.agent = agent
    this.defaultLinkSecretId = defaultLinkSecretId ?? walletName
  }

  public static async initialize({ uri, agent }: { uri: string; agent: Agent }) {
    const {
      config: { walletConfig },
    } = agent
    if (!walletConfig) throw new IndySdkToAskarMigrationError('Wallet config is required for updating the wallet')

    const keyMethod =
      walletConfig.keyDerivationMethod == KeyDerivationMethod.Raw ? StoreKeyMethod.Raw : StoreKeyMethod.Kdf
    const store = await Store.open({ uri, passKey: walletConfig.key, keyMethod })
    return new IndySdkToAskarMigrationUpdater(store, walletConfig.id, agent)
  }

  private async backupDatabase() {
    const fs = this.agent.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)
  }

  private async revertDatabase() {
    const fs = this.agent.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)
  }

  private async cleanBackup() {
    const fs = this.agent.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)
  }

  public async update() {
    try {
      await this.updateKeys()
      await this.updateMasterSecret()
      await this.updateCredentials()
    } catch (e) {
      this.agent.config.logger?.error('Migration failed. Reverting state.')

      await this.revertDatabase()
    } finally {
      await this.cleanBackup()
    }
  }

  private async updateKeys() {
    const category = 'Indy::Key'

    this.agent.config.logger?.trace(`[indy-sdk-to-askar-migration]: Updating category: ${category}`)

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
        await txn.remove({ category, name: row.name })
        const signKey: string = (typeof row.value === 'string' ? JSON.parse(row.value) : row.value).signkey
        const keySk = TypedArrayEncoder.fromBase58(signKey)
        const key = Key.fromSecretBytes({
          algorithm: KeyAlgs.Ed25519,
          secretKey: keySk.subarray(0, 32),
        })
        await txn.insertKey({ name: row.name, key })
        updateCount++
      }
      await txn.commit()
    }

    this.agent.config.logger?.trace(
      `[indy-sdk-to-askar-migration]: Updated ${updateCount} instances inside ${category}`
    )
  }

  private async updateMasterSecret() {
    const category = 'Indy::MasterSecret'

    this.agent.config.logger?.trace(`[indy-sdk-to-askar-migration]: Updating category: ${category}`)

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
        throw new IndySdkToAskarMigrationError('defaultLinkSecretId can not be established')
      }

      for (const row of masterSecrets) {
        const isDefault = masterSecrets.length === 0 ?? row.name === this.walletName
        await txn.remove({ category, name: row.name })

        const {
          value: { ms },
        } = JSON.parse(row.value as string) as { value: { ms: string } }

        const record = new AnonCredsLinkSecretRecord({ linkSecretId: row.name, value: ms })
        record.setTag('isDefault', isDefault)
        const value = JsonTransformer.serialize(record)

        const tags = transformFromRecordTagValues(record.getTags())

        await txn.insert({ category: record.type, name: record.id, value, tags })
        updateCount++
      }
      await txn.commit()
    }

    this.agent.config.logger?.trace(
      `[indy-sdk-to-askar-migration]: Updated ${updateCount} instances inside ${category}`
    )
  }

  private async updateCredentials() {
    const category = 'Indy::Credential'

    this.agent.config.logger?.trace(`[indy-sdk-to-askar-migration]: Updating category: ${category}`)

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
        await txn.remove({ category, name: row.name })
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
        })

        const tags = transformFromRecordTagValues(record.getTags())
        const value = JsonTransformer.serialize(record)

        await txn.insert({ category: record.type, name: record.id, value, tags })
        updateCount++
      }
      await txn.commit()
    }

    this.agent.config.logger?.trace(
      `[indy-sdk-to-askar-migration]: Updated ${updateCount} instances inside ${category}`
    )
  }
}
