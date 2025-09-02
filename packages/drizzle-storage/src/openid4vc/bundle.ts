import { DrizzleRecordBundle } from '../DrizzleRecord'
import { bundleMigrationDefinition } from '../util'
import { openId4VcIssuanceSessionDrizzleRecord } from './openid4vc-issuance-session-record'
import { openid4vcIssuerDrizzleRecord } from './openid4vc-issuer-record'
import { openId4VcVerificationSessionDrizzleRecord } from './openid4vc-verification-session-record'
import { openid4vcVerifierDrizzleRecord } from './openid4vc-verifier-record'

export default {
  name: 'openid4vc',
  records: [
    openid4vcIssuerDrizzleRecord,
    openId4VcIssuanceSessionDrizzleRecord,
    openid4vcVerifierDrizzleRecord,
    openId4VcVerificationSessionDrizzleRecord,
  ],

  migrations: bundleMigrationDefinition('openid4vc'),
} as const satisfies DrizzleRecordBundle
