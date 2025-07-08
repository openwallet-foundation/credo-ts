import { DrizzleRecordBundle } from '../DrizzleRecord'
import { openId4VcIssuanceSessionDrizzleRecord } from './openid4vc-issuance-session'
import { openid4vcIssuerDrizzleRecord } from './openid4vc-issuer'
import { openId4VcVerificationSessionDrizzleRecord } from './openid4vc-verification-session'
import { openid4vcVerifierDrizzleRecord } from './openid4vc-verifier'

export default {
  name: 'openid4vc',
  records: [
    openid4vcIssuerDrizzleRecord,
    openId4VcIssuanceSessionDrizzleRecord,
    openid4vcVerifierDrizzleRecord,
    openId4VcVerificationSessionDrizzleRecord,
  ],

  migrations: {
    postgres: {
      schemaModule: '@credo-ts/drizzle-storage/openid4vc/postgres',
      migrationsPath: '../../migrations/openid4vc/postgres',
    },
    sqlite: {
      schemaModule: '@credo-ts/drizzle-storage/openid4vc/sqlite',
      migrationsPath: '../../migrations/openid4vc/sqlite',
    },
  },
} as const satisfies DrizzleRecordBundle
