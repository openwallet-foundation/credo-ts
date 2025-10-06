import { JsonTransformer, TagsBase } from '@credo-ts/core'

import { OpenId4VcVerificationSessionRecord } from '@credo-ts/openid4vc'
import { DrizzleDatabase } from '../../DrizzleDatabase'
import {
  BaseDrizzleRecordAdapter,
  DrizzleAdapterRecordValues,
  DrizzleAdapterValues,
} from '../../adapter/BaseDrizzleRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleOpenId4VcVerificationSessionAdapterValues = DrizzleAdapterRecordValues<
  (typeof sqlite)['openId4VcVerificationSession']
>
export class DrizzleOpenId4VcVerificationSessionRecordAdapter extends BaseDrizzleRecordAdapter<
  OpenId4VcVerificationSessionRecord,
  typeof postgres.openId4VcVerificationSession,
  typeof postgres,
  typeof sqlite.openId4VcVerificationSession,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      { postgres: postgres.openId4VcVerificationSession, sqlite: sqlite.openId4VcVerificationSession },
      OpenId4VcVerificationSessionRecord
    )
  }

  public getValues(
    record: OpenId4VcVerificationSessionRecord
  ): DrizzleAdapterValues<(typeof sqlite)['openId4VcVerificationSession']> {
    const { authorizationRequestId, authorizationRequestUri, nonce, payloadState, state, verifierId, ...customTags } =
      record.getTags()

    return {
      authorizationRequestJwt: record.authorizationRequestJwt,
      authorizationRequestPayload: record.authorizationRequestPayload,
      authorizationResponsePayload: record.authorizationResponsePayload,
      authorizationResponseRedirectUri: record.authorizationResponseRedirectUri,
      errorMessage: record.errorMessage,
      expiresAt: record.expiresAt,
      presentationDuringIssuanceSession: record.presentationDuringIssuanceSession,
      authorizationRequestId,
      authorizationRequestUri,
      nonce,
      payloadState,
      state,
      verifierId,
      customTags,
    }
  }

  public toRecord(values: DrizzleOpenId4VcVerificationSessionAdapterValues): OpenId4VcVerificationSessionRecord {
    const { customTags, nonce, payloadState, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, OpenId4VcVerificationSessionRecord)
    if (customTags) record.setTags(customTags as TagsBase)

    return record
  }
}
