import type { EmulatorUserConfig } from './UserEmulator'
import type { EmulatorWitnessConfig } from './WitnessEmulator'
import type { SqliteDriver } from '@mikro-orm/sqlite'

import { MikroORM } from '@mikro-orm/core'

export interface EmulatorConfig {
  host: string
  port: number
  users: EmulatorUserConfig[]
  witnesses: EmulatorWitnessConfig[]
}

async function createOrm(dbName: string) {
  return await MikroORM.init<SqliteDriver>({
    baseDir: './node_modules/@sicpa-dlab/witness-gossip-protocol-ts',
    entitiesTs: ['./src/data-access/entities/*'],
    entities: ['./build/data-access/entities/*'],
    type: 'sqlite',
    dbName,
    schemaGenerator: {},
  })
}

export const createConfig: () => Promise<EmulatorConfig> = async () => {
  return {
    host: 'http://localhost',
    port: 8080,
    users: [
      {
        interval: 1000 * 6,
        witnessIndex: 0,
      },
      {
        interval: 1000 * 7,
        witnessIndex: 0,
      },
    ],
    witnesses: [
      {
        tockTime: 1000 * 5,
        orm: await createOrm('witness-1'),
      },
      {
        tockTime: 1000 * 5,
        orm: await createOrm('witness-2'),
      },
      {
        tockTime: 1000 * 5,
        orm: await createOrm('witness-3'),
      },
    ],
  }
}
