import type { BaseEvent } from '@credo-ts/core'
import type { DidCommConnectionRecord } from '../connections/repository'
import type { DidCommMessagePickupSession } from './DidCommMessagePickupSession'

export enum DidCommMessagePickupEventTypes {
  LiveSessionSaved = 'DidCommMessagePickupLiveSessionSaved',
  LiveSessionRemoved = 'DidCommMessagePickupLiveSessionRemoved',
  MessagePickupCompleted = 'DidCommMessagePickupCompleted',
}

export interface DidCommMessagePickupLiveSessionSavedEvent extends BaseEvent {
  type: typeof DidCommMessagePickupEventTypes.LiveSessionSaved
  payload: {
    session: DidCommMessagePickupSession
  }
}

export interface MessagePickupLiveSessionRemovedEvent extends BaseEvent {
  type: typeof DidCommMessagePickupEventTypes.LiveSessionRemoved
  payload: {
    session: DidCommMessagePickupSession
  }
}

export interface MessagePickupCompletedEvent extends BaseEvent {
  type: typeof DidCommMessagePickupEventTypes.MessagePickupCompleted
  payload: {
    connection: DidCommConnectionRecord
    threadId?: string
  }
}
