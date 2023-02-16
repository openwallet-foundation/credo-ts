import type { WalletDatabase } from './WalletDatabase'
import type { Item } from './types'
import type { ResultSet, SQLiteDatabase } from 'react-native-sqlite-storage'

import { openDatabase } from 'react-native-sqlite-storage'

//import { enablePromise, openDatabase } from 'react-native-sqlite-storage'

export class ReactNativeSqliteWalletDatabase implements WalletDatabase {
  private path: string
  private db?: SQLiteDatabase

  public constructor(path: string) {
    this.path = path
  }

  public async connect(): Promise<void> {
    this.db = await openDatabase({ name: this.path })
  }

  private async execQuery(query: string, args: any[] | undefined = []): Promise<ResultSet | undefined> {
    this.assertConnected()

    const res = (await this.db?.executeSql(query, args))?.[0]

    return res
  }

  private assertConnected() {
    if (!this.isConnected()) {
      throw new Error('Not connected to the database')
    }
  }

  public isConnected(): boolean {
    return !!this.db
  }

  public isUpdated(): Promise<boolean> {
    return Promise.resolve(!this.doesTableExist('metadata'))
  }

  public async preUpgrade(): Promise<void> {
    this.assertConnected()

    if (!this.doesTableExist('metadata')) {
      throw new Error('No metadata table found: not an Indy wallet database')
    }
    await this.execQuery(
      `CREATE TABLE config (
        name TEXT NOT NULL,
        value TEXT,
        PRIMARY KEY (name)
      );`
    )
    await this.execQuery(`CREATE TABLE profiles (
          id INTEGER NOT NULL,
          name TEXT NOT NULL,
          reference TEXT NULL,
          profile_key BLOB NULL,
          PRIMARY KEY (id)
      );`)
    await this.execQuery(`CREATE UNIQUE INDEX ix_profile_name ON profiles (name);`)
    await this.execQuery(`ALTER TABLE items RENAME TO items_old;`)
    await this.execQuery(`CREATE TABLE items (
          id INTEGER NOT NULL,
          profile_id INTEGER NOT NULL,
          kind INTEGER NOT NULL,
          category BLOB NOT NULL,
          name BLOB NOT NULL,
          value BLOB NOT NULL,
          expiry DATETIME NULL,
          PRIMARY KEY (id),
          FOREIGN KEY (profile_id) REFERENCES profiles (id)
              ON DELETE CASCADE ON UPDATE CASCADE
      );`)
    await this.execQuery(`CREATE UNIQUE INDEX ix_items_uniq ON items (profile_id, kind, category, name);`)
    await this.execQuery(`CREATE TABLE items_tags (
          id INTEGER NOT NULL,
          item_id INTEGER NOT NULL,
          name BLOB NOT NULL,
          value BLOB NOT NULL,
          plaintext BOOLEAN NOT NULL,
          PRIMARY KEY (id),
          FOREIGN KEY (item_id) REFERENCES items (id)
              ON DELETE CASCADE ON UPDATE CASCADE
      );`)
    await this.execQuery(`CREATE INDEX ix_items_tags_item_id ON items_tags (item_id);`)
    await this.execQuery(
      `CREATE INDEX ix_items_tags_name_enc ON items_tags (name, SUBSTR(value, 1, 12)) WHERE plaintext=0;`
    )
    await this.execQuery(`CREATE INDEX ix_items_tags_name_plain ON items_tags (name, value) WHERE plaintext=1;`)
  }

  public async insertProfile(passKey: string, name: string, key: Uint8Array): Promise<void> {
    this.assertConnected()
    await this.execQuery(`INSERT INTO config (name, value) VALUES (?, ?)`, ['default_profile', name])
    await this.execQuery(`INSERT INTO config (name, value) VALUES (?, ?)`, ['key', passKey])
    await this.execQuery(`INSERT INTO profiles (name, profile_key) VALUES (?, ?)`, [name, key.toString()])
  }

  public async finishUpgrade(): Promise<void> {
    this.assertConnected()
    await this.execQuery(`DROP TABLE items_old;`)
    await this.execQuery(`DROP TABLE metadata;`)
    await this.execQuery(`DROP TABLE tags_encrypted;`)
    await this.execQuery(`DROP TABLE tags_plaintext;`)
    await this.execQuery(`INSERT INTO config (name, value) VALUES ("version", "1");`)
  }

  public async fetchOne<T>(sql: string, optional?: boolean | undefined): Promise<T | undefined> {
    this.assertConnected()
    const result = await this.execQuery(sql)

    if (!result && !optional) {
      throw new Error('Could not find the row')
    }
    return result?.rows?.item(0) as T
  }

  public async fetchPendingItems<T>(limit: number): Promise<T | undefined> {
    this.assertConnected()
    const tmp = []
    const res = await this.execQuery(
      `SELECT i.id, i.type, i.name, i.value, i.key,
       (SELECT GROUP_CONCAT(HEX(te.name) || ':' || HEX(te.value))
       FROM tags_encrypted te WHERE te.item_id = i.id) AS tags_enc,
       (SELECT GROUP_CONCAT(HEX(tp.name) || ':' || HEX(tp.value))
       FROM tags_plaintext tp WHERE tp.item_id = i.id) AS tags_plain
       FROM items_old i LIMIT ?`,
      [limit]
    )

    const len = res?.rows?.length ?? 0
    for (let i = 0; i < len; i++) {
      const item = res?.rows?.item(i)
      if (item) tmp.push(item)
    }

    return tmp as T
  }

  public async updateItems(items: Item[]): Promise<void> {
    this.assertConnected()
    const deleteIds = []
    for (const item of items) {
      deleteIds.push(item.id)
      const result = await this.execQuery(
        `INSERT INTO items (profile_id, kind, category, name, value) 
         VALUES (1, 2, ?, ?, ?)`,
        [item.category, item.name, item.value]
      )
      const itemId = result?.insertId
      if (item.tags && item.tags.length !== 0) {
        const plaintext = item.tags[0][0]
        const name = item.tags[0][1]
        const value = item.tags[0][2]
        await this.execQuery(
          `INSERT INTO items_tags (item_id, plaintext, name, value)
          VALUES (?, ?, ?, ?)`,
          [itemId, plaintext, name, value]
        )
      }
    }

    await this.execQuery(`DELETE FROM items_old WHERE id IN (?)`, [deleteIds.join(',')])
  }

  public async close(): Promise<void> {
    this.assertConnected()
    await this.db?.close()
    this.db = undefined
  }

  public async doesTableExist(name: string): Promise<boolean> {
    this.assertConnected()
    try {
      const res = await this.execQuery(`SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`)
      return res?.rows ? res.rows.length > 0 : false
    } catch {
      return false
    }
  }
}
