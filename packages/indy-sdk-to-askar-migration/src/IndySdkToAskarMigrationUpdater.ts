/* eslint-disable no-console */
import { AnonCredsLinkSecretRecord } from '@aries-framework/anoncreds'
import { JsonTransformer, TypedArrayEncoder } from '@aries-framework/core'
import { Key, KeyAlgs, Store, StoreKeyMethod } from '@hyperledger/aries-askar-shared'

export class IndySdkToAskarMigrationUpdater {
  private store: Store
  private walletName: string

  private constructor(store: Store, walletName: string) {
    this.store = store
    this.walletName = walletName
  }

  public static async init(uri: string, walletName: string, masterPassword: string) {
    const store = await Store.open({ uri, passKey: masterPassword, keyMethod: StoreKeyMethod.Raw })
    return new IndySdkToAskarMigrationUpdater(store, walletName)
  }

  public async update() {
    await this.updateKeys()
    await this.updateMasterSecret()
    await this.updateCredentials()
  }

  private async updateKeys() {
    const category = 'Indy::Key'

    console.log(`Updating ${category}`)

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

    console.log(`Updated ${updateCount} instances inside ${category}`)
  }

  private async updateMasterSecret() {
    const category = 'Indy::MasterSecret'

    console.log(`Updating ${category}`)

    let updateCount = 0
    const session = this.store.transaction()
    for (;;) {
      const txn = await session.open()
      const masterSecrets = await txn.fetchAll({ category, limit: 50 })
      if (!masterSecrets || masterSecrets.length === 0) {
        await txn.close()
        break
      }

      for (const row of masterSecrets) {
        await txn.remove({ category, name: row.name })

        const isDefault = row.name === this.walletName

        const {
          value: { ms },
        } = JSON.parse(row.value as string) as { value: { ms: string } }

        const record = new AnonCredsLinkSecretRecord({ linkSecretId: row.name, value: ms })
        record.setTag('isDefault', isDefault)
        const value = JsonTransformer.serialize(record)

        // TODO: use exported message from askar to transform tags
        const tags = undefined

        await txn.insert({ category: record.type, name: record.id, value, tags })
        updateCount++
      }
      await txn.commit()
    }

    console.log(`Updated ${updateCount} instances inside ${category}`)
  }

  private async updateCredentials() {
    const category = 'Indy::Credential'

    console.log(`Updating ${category}`)

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
        const credentialData = typeof row.value === 'string' ? JSON.parse(row.value) : row.value
        const tags = this.credentialTags(credentialData)
        await txn.insert({
          category: 'credential',
          name: row.name,
          value: row.value,
          tags,
        })
        updateCount++
      }
      await txn.commit()
    }

    console.log(`Updated ${updateCount} instances inside ${category}`)
  }

  private credentialTags(credentialData: Record<string, unknown>) {
    const schemaId = credentialData.schema_id as string
    const credentialDefinitionId = credentialData.cred_def_id as string

    const { did, schemaName, schemaVersion } =
      /^(?<did>\w+):2:(?<schemaName>[^:]+):(?<schemaVersion>[^:]+)$/.exec(schemaId)?.groups ?? {}
    if (!did || !schemaName || !schemaVersion) throw new Error(`Error parsing credential schema id: ${schemaId}`)

    const { issuerId } =
      /^(?<issuerId>\w+):3:CL:(?<schemaIdOrSeqNo>[^:]+):(?<tag>[^:]+)$/.exec(credentialDefinitionId)?.groups ?? {}
    if (!issuerId) throw new Error(`Error parsing credential definition id: ${credentialDefinitionId}`)

    const tags = {
      schema_id: schemaId,
      schema_issuer_did: did,
      schema_name: schemaName,
      schema_version: schemaVersion,
      issuer_did: issuerId,
      cred_def_id: credentialDefinitionId,
      rev_reg_id: (credentialData.rev_reg_id as string) ?? 'None',
    } as Record<string, string>

    for (const [k, attrValue] of Object.entries(credentialData.values as Record<string, { raw: string }>)) {
      const attrName = k.replace(' ', '')
      const id = `attr::${attrName}::value`
      tags[id] = attrValue.raw
    }

    return tags
  }
}
