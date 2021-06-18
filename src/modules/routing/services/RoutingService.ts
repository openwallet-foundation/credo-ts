/*----------------------------------------------------------
| Routing service is the common code used in mediation senarios 
|*/
import { MediationRecord, MediationRecordProps } from '../../routing'
import { ConnectionRecord } from '../../connections'
import { MediationRepository } from '../repository'
import { BaseEvent } from '../../../agent/Events'
import { EventEmitter } from '../../../agent/EventEmitter'

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
  timeout = 500,
  eventEmitter: EventEmitter
): Promise<BaseEvent> => {
  // Capture an event and retrieve its value
  return new Promise<BaseEvent>(async (resolve, reject) => {
    setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting for event: ${eventName}`))
    }, timeout)

    const cleanup = () => {
      eventEmitter.off(eventName, handler)
      return true
    }

    const handler = async (event: BaseEvent) => {
      try {
        if ((await condition(event)) ?? true) {
          cleanup()
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
