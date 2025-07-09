import { DrizzleRecordBundle } from '../DrizzleRecord'
import { bundleMigrationDefinition } from '../util'
import { didcommBasicMessageDrizzleRecord } from './basic-message'
import { didcommConnectionDrizzleRecord } from './connection'
import { didcommCredentialExchangeDrizzleRecord } from './credential-exchange'
import { didcommMessageDrizzleRecord } from './didcomm-message'
import { didcommMediationDrizzleRecord } from './mediation'
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
    didcommMediationDrizzleRecord,
    didcommMediatorRoutingDrizzleRecord,
    didcommOutOfBandDrizzleRecord,
    didcommProofExchangeDrizzleRecord,
  ],

  migrations: bundleMigrationDefinition('didcomm'),
} as const satisfies DrizzleRecordBundle
