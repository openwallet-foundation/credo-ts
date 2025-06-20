import { DrizzleRecordBundle } from '../DrizzleRecord'
import { didcommBasicMessageDrizzleRecord } from './basic-message'
import { didcommConnectionDrizzleRecord } from './connection'
import { didcommCredentialExchangeDrizzleRecord } from './credential-exchange'
import { didcommMessageDrizzleRecord } from './didcomm-message'
import { didcommMediatorDrizzleRecord } from './mediator'
import { didcommMediatorRoutingDrizzleRecord } from './mediator-routing'
import { didcommOutOfBandDrizzleRecord } from './out-of-band'
import { didcommProofExchangeDrizzleRecord } from './proof-exchange'

export default {
  name: 'didcomm',
  records: [
    didcommBasicMessageDrizzleRecord,
    didcommConnectionDrizzleRecord,
    didcommCredentialExchangeDrizzleRecord,
    didcommMessageDrizzleRecord,
    didcommMediatorDrizzleRecord,
    didcommMediatorRoutingDrizzleRecord,
    didcommOutOfBandDrizzleRecord,
    didcommProofExchangeDrizzleRecord,
  ],

  migrations: {
    postgres: {
      schemaModule: '@credo-ts/drizzle-storage/didcomm/postgres',
      migrationsPath: '../../migrations/didcomm/postgres',
    },
    sqlite: {
      schemaModule: '@credo-ts/drizzle-storage/didcomm/sqlite',
      migrationsPath: '../../migrations/didcomm/sqlite',
    },
  },
} as const satisfies DrizzleRecordBundle
