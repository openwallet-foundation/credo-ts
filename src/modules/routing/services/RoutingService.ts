/*----------------------------------------------------------
| Routing service is the common code used in mediation senarios 
|*/
import {
  MediationRecord,
  MediationRecordProps,
} from '../../routing'
import { ConnectionRecord } from '../../connections'
import { MediationRepository } from '../repository'


export async function createRecord(
  { state, role, connectionId, recipientKeys }: MediationRecordProps,
  mediatorRepository: MediationRepository
): Promise<MediationRecord> {
  const mediationRecord = new MediationRecord({
    state,
    role,
    connectionId,
    recipientKeys,
    tags: {
      role,
      connectionId,
    },
  })
  await mediatorRepository.save(mediationRecord)
  return mediationRecord
}

export function assertConnection(record: ConnectionRecord | undefined, errormsg: string): ConnectionRecord {
  // Assert connection
  record?.assertReady()
  if (!record) {
    throw new Error(errormsg)
  }
  return record
}
