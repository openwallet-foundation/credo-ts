/*----------------------------------------------------------
| Routing service is the common code used in mediation senarios 
|*/
import type { EventEmitter } from '../../../agent/EventEmitter'
import type { BaseEvent } from '../../../agent/Events'
import type { ConnectionRecord } from '../../connections/repository/ConnectionRecord'
import type { MediationRecordProps } from '../repository/MediationRecord'
import type { MediationRepository } from '../repository/MediationRepository'

import { MediationRecord } from '../repository/MediationRecord'

/**
 * waitForEvent
 * eventProducer
 *    callable function():void{}
 * eventEmitter
 *    EventEmitter
 *    Emitter that will emit the event
 * eventName
 *    String
 *    the name of the event that will be emitted
 * filter
 *    callable function(event):boolean{}
 *    optional function returning whether or not the event satisfies conditions
 **/
/* eslint-disable */
export const waitForEvent = async (
  eventProducer: CallableFunction,
  eventName: string,
  condition: CallableFunction,
  timeout = 10000,
  eventEmitter: EventEmitter
): Promise<BaseEvent> => {
  // Capture an event and retrieve its value
  let complete = false
  return new Promise<BaseEvent>(async (resolve, reject) => {
    setTimeout(() => {
      if(!complete){
        cleanup();
        reject(new Error(`Timed out waiting for event: ${eventName}`))
      }
    }, timeout)

    const cleanup = () => {
      eventEmitter.off(eventName, handler)
      return true
    }

    const handler = async (event: BaseEvent) => {
      try {
        if ((await condition(event)) ?? true) {
          cleanup()
          complete = true
          resolve(event)
        }
      } catch (e) {
        cleanup()
        reject(e)
      }
    }
    try {
      eventEmitter.on(eventName, handler)
      await eventProducer()
    } catch (e) {
      cleanup()
      reject(e)
    }
  }).then((event) => {
    return event
  })
}
/* eslint-enable */
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
