import { JsonTransformer, type TagsBase } from '@credo-ts/core'

import { OpenId4VcIssuerRecord } from '@credo-ts/openid4vc'
import {
  BaseDrizzleRecordAdapter,
  type DrizzleAdapterRecordValues,
  type DrizzleAdapterValues,
} from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleOpenid4vcIssuerAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['openid4vcIssuer']>
export class DrizzleOpenid4vcIssuerRecordAdapter extends BaseDrizzleRecordAdapter<
  OpenId4VcIssuerRecord,
  typeof postgres.openid4vcIssuer,
  typeof postgres,
  typeof sqlite.openid4vcIssuer,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.openid4vcIssuer, sqlite: sqlite.openid4vcIssuer }, OpenId4VcIssuerRecord)
  }

  public getValues(record: OpenId4VcIssuerRecord): DrizzleAdapterValues<(typeof sqlite)['openid4vcIssuer']> {
    const { issuerId, ...customTags } = record.getTags()

    return {
      issuerId,
      accessTokenPublicJwk: record.accessTokenPublicJwk,
      accessTokenPublicKeyFingerprint: record.accessTokenPublicKeyFingerprint,
      credentialConfigurationsSupported: record.credentialConfigurationsSupported,
      dpopSigningAlgValuesSupported: record.dpopSigningAlgValuesSupported,
      signedMetadata: record.signedMetadata,
      display: record.display,
      authorizationServerConfigs: record.authorizationServerConfigs,
      batchCredentialIssuance: record.batchCredentialIssuance,

      customTags,
    }
  }

  public toRecord(values: DrizzleOpenid4vcIssuerAdapterValues): OpenId4VcIssuerRecord {
    const { customTags, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, OpenId4VcIssuerRecord)
    if (customTags) record.setTags(customTags as TagsBase)

    return record
  }
}
