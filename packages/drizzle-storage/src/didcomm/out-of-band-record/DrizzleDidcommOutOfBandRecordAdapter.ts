import { JsonTransformer } from '@credo-ts/core'

import {
  BaseDrizzleRecordAdapter,
  DrizzleAdapterRecordValues,
  DrizzleAdapterValues,
} from '../../adapter/BaseDrizzleRecordAdapter'

import { OutOfBandRecord } from '@credo-ts/didcomm'
import { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleDidcommOutOfBandAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['didcommOutOfBand']>
export class DrizzleDidcommOutOfBandRecordAdapter extends BaseDrizzleRecordAdapter<
  OutOfBandRecord,
  typeof postgres.didcommOutOfBand,
  typeof postgres,
  typeof sqlite.didcommOutOfBand,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.didcommOutOfBand, sqlite: sqlite.didcommOutOfBand }, OutOfBandRecord)
  }

  public tagKeyMapping = {
    invitationId: ['outOfBandInvitation', '@id'],
  } as const

  public getValues(record: OutOfBandRecord): DrizzleAdapterValues<(typeof sqlite)['didcommOutOfBand']> {
    const {
      invitationRequestsThreadIds,
      recipientKeyFingerprints,
      role,
      state,
      threadId,
      recipientRoutingKeyFingerprint,

      // Queried based on `outOfBandInvitation.@id`
      invitationId,

      ...customTags
    } = record.getTags()

    return {
      invitationRequestsThreadIds,
      role,
      state,
      threadId,

      recipientKeyFingerprints,
      recipientRoutingKeyFingerprint,

      outOfBandInvitation: record.outOfBandInvitation.toJSON(),
      reusable: record.reusable,
      alias: record.alias,
      autoAcceptConnection: record.autoAcceptConnection,
      invitationInlineServiceKeys: record.invitationInlineServiceKeys,
      mediatorId: record.mediatorId,
      reuseConnectionId: record.reuseConnectionId,

      customTags,
    }
  }

  public toRecord(values: DrizzleDidcommOutOfBandAdapterValues): OutOfBandRecord {
    const {
      customTags,
      recipientKeyFingerprints,
      recipientRoutingKeyFingerprint,
      threadId,
      invitationRequestsThreadIds,
      ...remainingValues
    } = values

    const record = JsonTransformer.fromJSON(remainingValues, OutOfBandRecord)
    record.setTags({
      ...customTags,
      recipientKeyFingerprints: recipientKeyFingerprints ?? undefined,
      recipientRoutingKeyFingerprint: recipientRoutingKeyFingerprint ?? undefined,
    })

    return record
  }
}
