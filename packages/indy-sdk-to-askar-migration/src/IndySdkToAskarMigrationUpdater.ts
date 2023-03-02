/* eslint-disable no-console */
import { TypedArrayEncoder } from '@aries-framework/core'
import { Key, KeyAlgs, Store } from '@hyperledger/aries-askar-shared'

export class IndySdkToAskarMigrationUpdater {
  private store: Store

  private constructor(store: Store) {
    this.store = store
  }

  public static async init(uri: string, masterPassword: string) {
    const store = await Store.open({ uri, passKey: masterPassword })
    return new IndySdkToAskarMigrationUpdater(store)
  }

  public async update() {
    await this.updateKeys()
    await this.updateMasterSecret()
    await this.updateDids()
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
      const ms = await txn.fetchAll({ category, limit: 50 })
      if (!ms || ms.length === 0) {
        await txn.close()
        break
      }
      if (ms.length > 1) throw new Error('Multiple Master Secrets found!')

      const row = ms[0]
      await txn.remove({ category, name: row.name })
      const value = (typeof row.value === 'string' ? JSON.parse(row.value) : row.value).value

      await txn.insert({ category: 'master_secret', name: row.name, value })
      updateCount++

      await txn.commit()
    }

    console.log(`Updated ${updateCount} instances inside ${category}`)
  }

  private async updateDids() {
    const category = 'Indy::Did'
    const categoryMeta = 'Indy::DidMetadata'

    console.log(`Updating ${category}`)

    let updateCount = 0
    const session = this.store.transaction()
    for (;;) {
      const txn = await session.open()
      const dids = await txn.fetchAll({ category, limit: 50 })
      if (!dids || dids.length === 0) {
        await txn.close()
        break
      }

      for (const row of dids) {
        await txn.remove({ category, name: row.name })
        const info = typeof row.value === 'string' ? JSON.parse(row.value) : row.value
        console.log(info)
        let meta
        try {
          meta = await txn.fetch({
            category: categoryMeta,
            name: row.name,
          })
        } catch {}
        let didMeta
        if (meta) {
          await txn.remove({ category: categoryMeta, name: meta.name })
          didMeta = (typeof meta.value === 'string' ? JSON.parse(meta.value) : meta.value).value
        }
        await txn.insert({
          category: 'did',
          name: row.name,
          value: {
            verkey: info.verkey,
            did: info.did,
            metadata: didMeta,
          },
          tags: { verkey: info.verkey },
        })
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
    const { did, schemaName, schemaVersion } =
      /^(?<did>\w+):2:(?<schemaName>[^:]+):(?<schemaVersion>[^:]+)$/.exec(schemaId)?.groups ?? {}
    if (!did || !schemaName || !schemaVersion) throw new Error(`Error parsing credential schema id: ${schemaId}`)
    const credentialDefinitionId = credentialData.cred_def_id as string
    const { issuerId } =
      /^(?<issuerId>\w+):3:CL:(?<schemaIdOrSeqNo>[^:]+):(?<tag>[^:]+)$/.exec(
        'Xqxxkqwb6gaCt7wUPwVfGZ:3:CL:620792:default'
      )?.groups ?? {}
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

    for (const [k, attrValue] of Object.entries(credentialData.values as Array<any>)) {
      const attrName = k.replace(' ', '')
      const id = `attr::${attrName}::value`
      tags[id] = attrValue.raw
    }

    return tags
  }
}
