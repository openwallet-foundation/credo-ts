import { JsonTransformer, TagsBase } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter, DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'

import { AnonCredsKeyCorrectnessProofRecord } from '@credo-ts/anoncreds'
import { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleAnonCredsKeyCorrectnessProofAdapterValues = DrizzleAdapterRecordValues<
  (typeof sqlite)['anonCredsKeyCorrectnessProof']
>
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
      'AnonCredsKeyCorrectnessProofRecord'
    )
  }

  public getValues(record: AnonCredsKeyCorrectnessProofRecord) {
    const { credentialDefinitionId, ...customTags } = record.getTags()

    return {
      credentialDefinitionId,
      value: record.value,
      customTags,
    }
  }

  public toRecord(values: DrizzleAnonCredsKeyCorrectnessProofAdapterValues): AnonCredsKeyCorrectnessProofRecord {
    const { customTags, credentialDefinitionId, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, AnonCredsKeyCorrectnessProofRecord)
    record.setTags({ ...customTags, credentialDefinitionId } as TagsBase)

    return record
  }
}
