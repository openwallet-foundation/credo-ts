import type { WalletDatabase } from './WalletDatabase'
import type { IndyKey, Item, ItemFromDb, Key, Keys, ProfileKey, Tags } from './types'
import type { BaseAgent } from '@aries-framework/core'

import { utils } from '@aries-framework/core'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import { Buffer } from 'buffer'
import { encode } from 'cbor'
import crypto from 'crypto-js'
import HmacSHA256 from 'crypto-js/hmac-sha256'
import { ExternalDirectoryPath } from 'react-native-fs'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import s from 'react-native-sodium'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import sodium from 'sodium-javascript'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import msgpack from 'tiny-msgpack'

import { IndySdkToAskarMigrationUpdater } from './IndySdkToAskarMigrationUpdater'
import { ReactNativeSqliteWalletDatabase } from './ReactNativeSqliteWalletDatabase'
import { CHACHAPOLY_KEY_LEN, CHACHAPOLY_NONCE_LEN } from './constants'
import { IndySdkToAskarMigrationError } from './errors/IndySdkToAskarMigrationError'

export type MigrationConfig = {
  walletName: string
  walletKey: string
  targetOs: 'android' | 'ios'
}

export class IndySdkToAskarMigrationAssistant<Agent extends BaseAgent<any> = BaseAgent<any>> {
  private walletName: string
  private walletKey: string
  //private fileSystem: FileSystem
  private walletDatabase: WalletDatabase
  //private logger: Logger
  private targetOs: 'android' | 'ios'

  private get walletPath() {
    let path
    if (this.targetOs === 'android') {
      // TODO: confirm whether this is the correct path
      path = ExternalDirectoryPath
    } else if (this.targetOs === 'ios') {
      path = '/home/indy/Documents/'
    } else {
      throw new IndySdkToAskarMigrationError('Unknown target os: ', this.targetOs)
    }

    return `${path}/.indy_client/wallet/${this.walletName}/sqlite.db`
  }

  public constructor(agent: Agent, { walletKey, walletName, targetOs }: MigrationConfig) {
    this.walletName = walletName
    this.walletKey = walletKey
    this.targetOs = targetOs

    //this.fileSystem = agent.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)
    //this.logger = agent.dependencyManager.resolve<Logger>(InjectionSymbols.Logger)

    // TODO: incorrect path
    this.walletDatabase = new ReactNativeSqliteWalletDatabase(this.walletPath)
  }

  private async assertConnected() {
    const isConnected = this.walletDatabase.isConnected()
    if (!isConnected) {
      throw new IndySdkToAskarMigrationError('Not connected to the database instance')
    }
  }

  public async isMigrated(): Promise<boolean> {
    await this.assertConnected()
    return this.walletDatabase.isUpdated()
  }

  private async backup() {
    //this.logger.error('TODO: backup')
  }

  public async migrate(): Promise<void> {
    //this.logger.info('Starting migration script')

    await this.backup()

    await this.walletDatabase.connect()

    try {
      await this.walletDatabase.preUpgrade()
      const indyKey = await this.fetchIndyKey()
      const profileKey = await this.initProfile(indyKey)
      await this.updateItems(indyKey, profileKey)
      await this.walletDatabase.finishUpgrade()
    } finally {
      await this.walletDatabase.close()
    }

    const updater = await IndySdkToAskarMigrationUpdater.init(`sqlite://${this.walletPath}`, this.walletKey)
    await updater.update()
  }

  private async fetchIndyKey(): Promise<IndyKey> {
    const metadataRow = await this.walletDatabase.fetchOne<{ value: Uint8Array }>('SELECT value FROM metadata')
    if (!metadataRow) {
      throw new Error('metadata could not be found in the db')
    }
    const metadataValue = Buffer.from(metadataRow.value).toString('ascii')
    const decodedValue = Buffer.from(metadataValue, 'base64').toString('utf8')
    const { keys: keysEnc, master_key_salt: salt } = JSON.parse(decodedValue) as {
      keys: Array<number>
      master_key_salt: Array<number>
    }

    const saltSlice = Uint8Array.from(salt).subarray(0, 16)
    const base64Key = Buffer.from(this.walletKey).toString('base64')
    const base64Salt = Buffer.from(saltSlice).toString('base64')

    const base64MasterKey = await s.crypto_pwhash(
      CHACHAPOLY_KEY_LEN,
      base64Key,
      base64Salt,
      6,
      134217728,
      s.crypto_pwhash_ALG_ARGON2I13
    )
    const masterKey = Buffer.from(base64MasterKey, 'base64')

    const keysMpk = this.decryptMerged(Uint8Array.from(keysEnc), Uint8Array.from(masterKey))
    const keysLst = msgpack.decode(keysMpk)
    const indyKey = {
      type: keysLst[0],
      name: keysLst[1],
      value: keysLst[2],
      item_hmac: keysLst[3],
      tag_name: keysLst[4],
      tag_value: keysLst[5],
      tag_hmac: keysLst[6],
      master: Buffer.from(masterKey),
      salt: Buffer.from(saltSlice),
    }

    return indyKey
  }

  private async initProfile(indyKey: IndyKey) {
    const profileKey = {
      ver: '1',
      ick: indyKey.type,
      ink: indyKey.name,
      ihk: indyKey.item_hmac,
      tnk: indyKey.tag_name,
      tvk: indyKey.tag_value,
      thk: indyKey.tag_hmac,
    }
    const passKey = 'kdf:argon2i:13:mod?salt=' + Buffer.from(indyKey.salt).toString('hex')
    const message = encode(profileKey)
    const encPk = this.encryptMerged(Uint8Array.from(message), indyKey.master)
    await this.walletDatabase.insertProfile(passKey, utils.uuid(), encPk)
    return profileKey
  }

  private async updateItems(indyKey: IndyKey, profileKey: ProfileKey) {
    for (;;) {
      const rows = await this.walletDatabase.fetchPendingItems<Array<string>>(1)
      if (!rows || rows.length === 0) break

      const upd: Array<Item> = []

      for (const row of rows) {
        const item = typeof row === 'string' ? JSON.parse(row) : row
        item.key = Buffer.from(item.key, 'base64')
        item.type = Buffer.from(item.type, 'base64')
        item.value = Buffer.from(item.value, 'base64')
        item.name = Buffer.from(item.name, 'base64')
        const result = this.decryptItem(item, indyKey)

        // TODO: check if result.value is ever undefined
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        upd.push(this.updateItem(result, profileKey))
      }
      await this.walletDatabase.updateItems(upd)
    }
  }

  private encryptMerged(message: Uint8Array, key: Uint8Array, hmacKey?: Uint8Array) {
    let nonce: Uint8Array
    if (hmacKey) {
      const hmac = HmacSHA256(this.convertUint8ArrayToWordArray(message), this.convertUint8ArrayToWordArray(hmacKey))
      nonce = this.convertWordArrayToUint8Array(hmac).subarray(0, CHACHAPOLY_NONCE_LEN)
    } else {
      const tmpBuf = new Uint8Array(CHACHAPOLY_NONCE_LEN)
      nonce = new Uint8Array(tmpBuf.map(() => Math.random() * 254))
    }

    const c = Buffer.alloc(message.byteLength + sodium.crypto_aead_chacha20poly1305_ietf_ABYTES)
    const m = Buffer.from(message)
    const ad = null
    const nsec = null
    const npub = Buffer.from(nonce)
    const k = Buffer.from(key)

    sodium.crypto_aead_chacha20poly1305_ietf_encrypt(c, m, ad, nsec, npub, k)

    return new Uint8Array([...nonce, ...Uint8Array.from(c)])
  }

  private decryptMerged(encValue: Uint8Array, key: Uint8Array) {
    const nonce = encValue.subarray(0, CHACHAPOLY_NONCE_LEN)
    const ciphertext = encValue.subarray(CHACHAPOLY_NONCE_LEN)

    const c = Buffer.from(ciphertext)
    const m = Buffer.alloc(c.byteLength - sodium.crypto_aead_chacha20poly1305_ietf_ABYTES)
    const npub = Buffer.from(nonce)
    const k = Buffer.from(key)

    sodium.crypto_aead_chacha20poly1305_ietf_decrypt(m, null, c, null, npub, k)
    return m
  }

  private decryptItem(row: ItemFromDb, keys: Keys) {
    const valueKey = this.decryptMerged(row.key, keys.value)
    const value = row.value ? this.decryptMerged(row.value, valueKey) : undefined
    const tags: Tags = []

    const decryptedTagsEnc = row.tags_enc ? this.decryptTags(row.tags_enc, keys.tag_name, keys.tag_value) : []
    decryptedTagsEnc.forEach(([k, v]) => {
      tags.push([0, k, v])
    })

    const decryptedTagsPlain = row.tags_plain ? this.decryptTags(row.tags_plain, keys.tag_name) : []
    decryptedTagsPlain.forEach(([k, v]) => {
      tags.push([1, k, v])
    })

    const result = {
      id: row.id,
      type: this.decryptMerged(row.type, keys.type),
      name: this.decryptMerged(row.name, keys.name),
      value,
      tags,
    }

    return result
  }

  private decryptTags(tags: string, nameKey: Uint8Array, valueKey?: Uint8Array) {
    const ret: Array<[Uint8Array, Uint8Array]> = []
    for (const tag of tags.split(',')) {
      const [tagName, tagValue] = tag.split(':').map((t) => Buffer.from(t, 'hex'))
      const name = this.decryptMerged(tagName, nameKey)
      const value = valueKey ? this.decryptMerged(tagValue, valueKey) : Buffer.from(tag[1])
      ret.push([name, value])
    }
    return ret
  }

  private updateItem(item: Item, key: Key) {
    const tags: Array<[number, Uint8Array, Uint8Array]> = []

    if (item.tags) {
      // eslint-disable-next-line prefer-const
      for (let [plain, k, v] of item.tags) {
        if (!plain) {
          v = this.encryptMerged(v, key.tvk, key.thk)
        }
        k = this.encryptMerged(k, key.tnk, key.thk)
        tags.push([plain, k, v])
      }
    }

    return {
      id: item.id,
      category: this.encryptMerged(item.type, key.ick, key.ihk),
      name: this.encryptMerged(item.name, key.ink, key.ihk),
      value: this.encryptValue(item.type, item.name, item.value, key.ihk),
      tags,
    }
  }

  private convertWordArrayToUint8Array(wordArray: crypto.lib.WordArray) {
    const hex = crypto.enc.Hex.stringify(wordArray)
    return Uint8Array.from(Buffer.from(hex, 'hex'))
  }

  private convertUint8ArrayToWordArray(u8Array: Uint8Array) {
    const buf = Buffer.from(u8Array).toString('hex')
    return crypto.enc.Hex.parse(buf)
  }

  private encryptValue(category: Uint8Array, name: Uint8Array, value: Uint8Array, hmacKey: Uint8Array) {
    const categoryLength = Buffer.alloc(4)
    categoryLength.writeIntBE(category.length, 3, 1)

    const nameLength = Buffer.alloc(4)
    nameLength.writeIntBE(name.length, 3, 1)

    const msg = new Uint8Array([
      ...Uint8Array.from(categoryLength),
      ...category,
      ...Uint8Array.from(nameLength),
      ...name,
    ])

    const hmacKeyWordArray = this.convertUint8ArrayToWordArray(hmacKey)
    const msgWordArray = this.convertUint8ArrayToWordArray(msg)
    const res = HmacSHA256(msgWordArray, hmacKeyWordArray)
    const valueKey = this.convertWordArrayToUint8Array(res)

    return this.encryptMerged(value, valueKey)
  }
}
