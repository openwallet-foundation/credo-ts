import { AnonCredsKeyCorrectnessProofRecord } from '@credo-ts/anoncreds'
import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleAnonCredsKeyCorrectnessProofRecordAdapter extends BaseDrizzleRecordAdapter<
  AnonCredsKeyCorrectnessProofRecord,
  typeof postgres.anonCredsKeyCorrectnessProof,
  typeof postgres,
  typeof sqlite.anonCredsKeyCorrectnessProof,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      { postgres: postgres.anonCredsKeyCorrectnessProof, sqlite: sqlite.anonCredsKeyCorrectnessProof },
      AnonCredsKeyCorrectnessProofRecord
    )
  }
}
