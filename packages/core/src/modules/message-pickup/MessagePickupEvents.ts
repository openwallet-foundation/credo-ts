import type { MessagePickupSession } from './MessagePickupSession'
import type { BaseEvent } from '../../agent/Events'
import type { ConnectionRecord } from '../connections'

export enum MessagePickupEventTypes {
  LiveSessionSaved = 'LiveSessionSaved',
  LiveSessionRemoved = 'LiveSessionRemoved',
  MessagePickupCompleted = 'MessagePickupCompleted',
}

export interface MessagePickupLiveSessionSavedEvent extends BaseEvent {
  type: typeof MessagePickupEventTypes.LiveSessionSaved
  payload: {
    session: MessagePickupSession
  }
}

export interface MessagePickupLiveSessionRemovedEvent extends BaseEvent {
  type: typeof MessagePickupEventTypes.LiveSessionRemoved
  payload: {
    session: MessagePickupSession
  }
}

export interface MessagePickupCompletedEvent extends BaseEvent {
  type: typeof MessagePickupEventTypes.MessagePickupCompleted
  payload: {
    connection: ConnectionRecord
    threadId?: string
  }
}
