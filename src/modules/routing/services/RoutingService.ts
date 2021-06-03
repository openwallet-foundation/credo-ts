/*----------------------------------------------------------
| Routing service is the common code used in mediation senarios 
|*/
import {
  KeylistState,
  KeylistUpdateEvent,
  MediationRecord,
  MediationRecordProps,
  MediationState,
  RecipientService,
} from '../../routing'
import { waitForEventWithTimeout } from '../../../utils/promiseWithTimeOut'
import { Wallet } from '../../../wallet/Wallet'
import { AgentConfig } from '../../../agent/AgentConfig'
import { ConnectionRecord } from '../../connections'
import { MediationRepository } from '../repository'
import { EventEmitter } from '../../../agent/EventEmitter'
import { RoutingEventTypes } from '../RoutingEvents'

export async function getRouting(
  config: AgentConfig,
  wallet: Wallet,
  eventEmitter: EventEmitter,
  recipientService: RecipientService,
  mediatorId: string | undefined,
  routingKeys: string[],
  my_endpoint?: string
) {
  let mediationRecord: MediationRecord | null = null
  let endpoint
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
  // Create and store new key
  const did_data = await wallet.createDid()
  if (mediationRecord) {
    const message = await recipientService.createKeylistUpdateMessage(did_data[1])
    const event: KeylistUpdateEvent = {
      type: RoutingEventTypes.MediationKeylistUpdate,
      payload: {
        mediationRecord,
        message,
      },
    }
    // emit KeylistState.update and catch KeylistState.updated event in module from mediationservice handler
    // send and update message to mediator
    await waitForEventWithTimeout(eventEmitter, event, RoutingEventTypes.KeylistUpdated, message, 20000)
  } else {
    // TODO: register recipient keys for relay
    // TODO: check that recipient keys are in wallet
  }
  endpoint = endpoint ?? my_endpoint ?? config.getEndpoint()
  const result = { mediationRecord, endpoint, routingKeys, did: did_data[0], verkey: did_data[1] }
  return result
}

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
