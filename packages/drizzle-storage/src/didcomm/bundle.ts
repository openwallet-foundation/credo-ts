import { DrizzleRecordBundle } from '../DrizzleRecord'
import { bundleMigrationDefinition } from '../util'
import { didcommBasicMessageDrizzleRecord } from './basic-message-record'
import { didcommConnectionDrizzleRecord } from './connection-record'
import { didcommCredentialExchangeDrizzleRecord } from './credential-exchange-record'
import { didcommMessageDrizzleRecord } from './didcomm-message-record'
import { didcommMediationDrizzleRecord } from './mediation-record'
import { didcommMediatorRoutingDrizzleRecord } from './mediator-routing-record'
import { didcommOutOfBandDrizzleRecord } from './out-of-band-record'
import { didcommProofExchangeDrizzleRecord } from './proof-exchange-record'

export default {
  name: 'didcomm',
  records: [
    didcommBasicMessageDrizzleRecord,
    didcommConnectionDrizzleRecord,
    didcommCredentialExchangeDrizzleRecord,
    didcommMessageDrizzleRecord,
    didcommMediationDrizzleRecord,
    didcommMediatorRoutingDrizzleRecord,
    didcommOutOfBandDrizzleRecord,
    didcommProofExchangeDrizzleRecord,
  ],

  migrations: bundleMigrationDefinition('didcomm'),
} as const satisfies DrizzleRecordBundle
