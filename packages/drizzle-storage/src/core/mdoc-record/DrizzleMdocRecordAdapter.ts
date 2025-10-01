import { JsonTransformer, MdocRecord } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter, DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'

import { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleMdocAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['mdoc']>
export class DrizzleMdocRecordAdapter extends BaseDrizzleRecordAdapter<
  MdocRecord,
  typeof postgres.mdoc,
  typeof postgres,
  typeof sqlite.mdoc,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.mdoc, sqlite: sqlite.mdoc }, MdocRecord)
  }

  public getValues(record: MdocRecord) {
    const { alg, docType, ...customTags } = record.getTags()

    return {
      alg,
      docType,
      base64Url: record.base64Url,
      customTags,
    }
  }

  public toRecord(values: DrizzleMdocAdapterValues): MdocRecord {
    const { alg, docType, customTags, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, MdocRecord)
    record.setTags({
      alg,
      docType,
      ...customTags,
    })

    return record
  }
}
