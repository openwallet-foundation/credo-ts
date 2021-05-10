/*----------------------------------------------------------
| Routing service is the common code used in mediation senarios 
|*/
import { KeylistState, KeylistUpdateMessage, MediationRecord, MediationRecordProps, MediationRole, MediationState, RecipientService } from '../../routing'
import { waitForEventWithTimeout } from '../../../utils/promiseWithTimeOut'
import { Did, Verkey } from 'indy-sdk'
import { Wallet } from '../../../wallet/Wallet'
import EventEmitter from 'events'
import { AgentConfig } from '../../../agent/AgentConfig'
import { Repository } from '../../../storage/Repository'
import { ConnectionRecord } from '../../connections'

export interface keylistUpdateEvent {
  mediationRecord: MediationRecord
  message: KeylistUpdateMessage
}

export async function getRouting(
  config: AgentConfig,
  emitter: EventEmitter,
  wallet: Wallet,
  recipientService: RecipientService,
  mediatorId: string | undefined,
  recipientKeys: string[],
  routingKeys: string[],
  my_endpoint?: string
) {
  let mediationRecord: MediationRecord | null = null
  let endpoint, did_data: [Did, Verkey]
  const defaultMediator = await recipientService.getDefaultMediator()
  if (mediatorId) {
    mediationRecord = await recipientService.findById(mediatorId)
  } else if (defaultMediator) {
    mediationRecord = defaultMediator
  }
  if (mediationRecord) {
    if (mediationRecord.state !== MediationState.Granted) {
      throw new Error(`Mediation State for ${mediationRecord.id} is not granted!`)
    }
    routingKeys = [...routingKeys, ...mediationRecord.routingKeys]
    endpoint = mediationRecord.endpoint
  }
  if (!recipientKeys) {
    // Create and store new key
    did_data = await wallet.createDid()
    recipientKeys = [did_data[1]]
    if (mediationRecord) {
      const message = await recipientService.createKeylistUpdateMessage(recipientKeys[0])
      const event: keylistUpdateEvent = {
        mediationRecord,
        message,
      }
      emitter.emit(KeylistState.Update, event)
      //catch this event in module and send and update message to mediator
      //emit KeylistState.updated event on this listener from mediationservice handler
      await waitForEventWithTimeout(emitter, KeylistState.Updated, message, 2000)
    }
  } else {
    // TODO: register recipient keys for relay
    // TODO: check that recipient keys are in wallet
    did_data = ['', recipientKeys[1]] // TODO: extract did, also first key the correct one?
  }
  endpoint = my_endpoint ?? config.getEndpoint()
  return { mediationRecord, endpoint, routingKeys, did: did_data[0], verkey: did_data[1] }
}

export async function createRecord(
  {
    state,
    role,
    connectionId,
    recipientKeys,
  }: MediationRecordProps,
  mediatorRepository: Repository<MediationRecord>
): Promise<MediationRecord> {
  const mediationRecord = new MediationRecord({
    state,
    role,
    connectionId,
    recipientKeys,
    tags: {
      state,
      role,
      connectionId,
      default: 'false',
    },
  })
  await mediatorRepository.save(mediationRecord)
  return mediationRecord
}

export function assertConnection(record:ConnectionRecord| undefined, errormsg:string): ConnectionRecord {
  // Assert connection
  record?.assertReady()
  if (!record) {
    throw new Error(errormsg)
  }
  return record
}
