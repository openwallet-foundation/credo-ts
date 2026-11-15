import { DidCommOutOfBandRecord } from '@credo-ts/didcomm'
import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleDidcommOutOfBandRecordAdapter extends BaseDrizzleRecordAdapter<
  DidCommOutOfBandRecord,
  typeof postgres.didcommOutOfBand,
  typeof postgres,
  typeof sqlite.didcommOutOfBand,
  typeof sqlite
> {
  public customTagColumns = ['recipientKeyFingerprints', 'recipientRoutingKeyFingerprint']

  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.didcommOutOfBand, sqlite: sqlite.didcommOutOfBand }, DidCommOutOfBandRecord)
  }

  public tagKeyMapping = {
    invitationId: ['outOfBandInvitation', '@id'],
  } as const
}
