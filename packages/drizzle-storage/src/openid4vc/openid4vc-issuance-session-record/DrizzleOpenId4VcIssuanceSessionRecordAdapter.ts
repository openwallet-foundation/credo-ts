import { JsonTransformer, type TagsBase } from '@credo-ts/core'
import { OpenId4VcIssuanceSessionRecord } from '@credo-ts/openid4vc'
import {
  BaseDrizzleRecordAdapter,
  type DrizzleAdapterRecordValues,
  type DrizzleAdapterValues,
} from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleOpenId4VcIssuanceSessionMenuAdapterValues = DrizzleAdapterRecordValues<
  (typeof sqlite)['openId4VcIssuanceSession']
>
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

  public getValues(
    record: OpenId4VcIssuanceSessionRecord
  ): DrizzleAdapterValues<(typeof sqlite)['openId4VcIssuanceSession']> {
    const {
      authorizationCode,
      authorizationSubject,
      credentialOfferId,
      credentialOfferUri,
      issuerId,
      issuerState,
      preAuthorizedCode,
      presentationAuthSession,
      chainedIdentityRequestUriReferenceValue,
      chainedIdentityState,
      state,
      ...customTags
    } = record.getTags()

    return {
      credentialOfferId,
      credentialOfferUri,
      generateRefreshTokens: record.generateRefreshTokens,
      issuerId,
      preAuthorizedCode,
      state,
      expiresAt: record.expiresAt,
      transactions: record.transactions,

      credentialOfferPayload: record.credentialOfferPayload,
      authorization: record.authorization
        ? {
            ...record.authorization,
            codeExpiresAt: record.authorization.codeExpiresAt?.toISOString(),
          }
        : undefined,
      chainedIdentity: record.chainedIdentity
        ? {
            ...record.chainedIdentity,
            requestUriExpiresAt: record.chainedIdentity.requestUriExpiresAt?.toISOString(),
          }
        : undefined,
      clientId: record.clientId,
      dpop: record.dpop,
      errorMessage: record.errorMessage,
      issuanceMetadata: record.issuanceMetadata,
      issuedCredentials: record.issuedCredentials,
      pkce: record.pkce,
      presentation: record.presentation,
      userPin: record.userPin,
      walletAttestation: record.walletAttestation,
      customTags,
    }
  }

  public toRecord(values: DrizzleOpenId4VcIssuanceSessionMenuAdapterValues): OpenId4VcIssuanceSessionRecord {
    const { customTags, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, OpenId4VcIssuanceSessionRecord)
    if (customTags) record.setTags(customTags as TagsBase)

    return record
  }
}
