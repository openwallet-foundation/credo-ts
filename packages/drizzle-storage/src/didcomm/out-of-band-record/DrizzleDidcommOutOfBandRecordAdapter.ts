import { JsonTransformer } from '@credo-ts/core'
import { DidCommOutOfBandRecord } from '@credo-ts/didcomm'
import {
  BaseDrizzleRecordAdapter,
  type DrizzleAdapterRecordValues,
  type DrizzleAdapterValues,
} from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleDidcommOutOfBandAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['didcommOutOfBand']>
export class DrizzleDidcommOutOfBandRecordAdapter extends BaseDrizzleRecordAdapter<
  DidCommOutOfBandRecord,
  typeof postgres.didcommOutOfBand,
  typeof postgres,
  typeof sqlite.didcommOutOfBand,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.didcommOutOfBand, sqlite: sqlite.didcommOutOfBand }, DidCommOutOfBandRecord)
  }

  public tagKeyMapping = {
    invitationId: ['outOfBandInvitation', '@id'],
  } as const

  public getValues(record: DidCommOutOfBandRecord): DrizzleAdapterValues<(typeof sqlite)['didcommOutOfBand']> {
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

  public toRecord(values: DrizzleDidcommOutOfBandAdapterValues): DidCommOutOfBandRecord {
    const {
      customTags,
      recipientKeyFingerprints,
      recipientRoutingKeyFingerprint,
      threadId,
      invitationRequestsThreadIds,
      ...remainingValues
    } = values

    const record = JsonTransformer.fromJSON(remainingValues, DidCommOutOfBandRecord)
    record.setTags({
      ...customTags,
      recipientKeyFingerprints: recipientKeyFingerprints ?? undefined,
      recipientRoutingKeyFingerprint: recipientRoutingKeyFingerprint ?? undefined,
    })

    return record
  }
}
