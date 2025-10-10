import { JsonTransformer, type TagsBase } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter, type DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'

import { type ActionMenuOptions, ActionMenuRecord, type ActionMenuSelectionOptions } from '@credo-ts/action-menu'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleDidcommActionMenuAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['didcommActionMenu']>
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

  public getValues(record: ActionMenuRecord) {
    const { role, connectionId, threadId, ...customTags } = record.getTags()

    return {
      role,
      threadId,
      connectionId,
      state: record.state,
      menu: record.menu ? (JsonTransformer.toJSON(record.menu) as ActionMenuOptions) : null,
      performedAction: record.performedAction
        ? (JsonTransformer.toJSON(record.performedAction) as ActionMenuSelectionOptions)
        : null,
      customTags,
    }
  }

  public toRecord(values: DrizzleDidcommActionMenuAdapterValues): ActionMenuRecord {
    const { customTags, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, ActionMenuRecord)
    if (customTags) record.setTags(customTags as TagsBase)

    return record
  }
}
