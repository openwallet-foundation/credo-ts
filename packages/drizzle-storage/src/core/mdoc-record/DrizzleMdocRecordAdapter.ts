import { MdocRecord } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'

import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

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
}
