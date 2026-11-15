import { OpenId4VcIssuanceSessionRecord } from '@credo-ts/openid4vc'
import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleOpenId4VcIssuanceSessionRecordAdapter extends BaseDrizzleRecordAdapter<
  OpenId4VcIssuanceSessionRecord,
  typeof postgres.openId4VcIssuanceSession,
  typeof postgres,
  typeof sqlite.openId4VcIssuanceSession,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      { postgres: postgres.openId4VcIssuanceSession, sqlite: sqlite.openId4VcIssuanceSession },
      OpenId4VcIssuanceSessionRecord
    )
  }

  public tagKeyMapping = {
    issuerState: ['authorization', 'issuerState'],
    authorizationCode: ['authorization', 'code'],
    authorizationSubject: ['authorization', 'subject'],
    presentationAuthSession: ['presentation', 'authSession'],
    chainedIdentityRequestUriReferenceValue: ['chainedIdentity', 'requestUriReferenceValue'],
    chainedIdentityState: ['chainedIdentity', 'externalState'],
  } as const
}
