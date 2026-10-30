import { ActionMenuRecord } from '@credo-ts/action-menu'
import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleDidcommActionMenuRecordAdapter extends BaseDrizzleRecordAdapter<
  ActionMenuRecord,
  typeof postgres.didcommActionMenu,
  typeof postgres,
  typeof sqlite.didcommActionMenu,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.didcommActionMenu, sqlite: sqlite.didcommActionMenu }, ActionMenuRecord)
  }
}
