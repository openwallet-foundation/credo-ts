import type { MessagePickupSession } from './MessagePickupSession'
import type { BaseEvent } from '../../agent/Events'

export enum MessagePickupEventTypes {
  LiveSessionSaved = 'LiveSessionSaved',
  LiveSessionRemoved = 'LiveSessionRemoved',
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
