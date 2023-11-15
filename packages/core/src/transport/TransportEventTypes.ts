import type { BaseEvent } from '../agent/Events'
import type { TransportSession } from '../agent/TransportService'

export enum TransportEventTypes {
  OutboundWebSocketClosedEvent = 'OutboundWebSocketClosedEvent',
  OutboundWebSocketOpenedEvent = 'OutboundWebSocketOpenedEvent',
  TransportSessionSaved = 'TransportSessionSaved ',
  TransportSessionRemoved = 'TransportSessionSaved ',
}

export interface OutboundWebSocketClosedEvent extends BaseEvent {
  type: TransportEventTypes.OutboundWebSocketClosedEvent
  payload: {
    socketId: string
    connectionId?: string
  }
}

export interface OutboundWebSocketOpenedEvent extends BaseEvent {
  type: TransportEventTypes.OutboundWebSocketOpenedEvent
  payload: {
    socketId: string
    connectionId?: string
  }
}

export interface TransportSessionSavedEvent extends BaseEvent {
  type: typeof TransportEventTypes.TransportSessionSaved
  payload: {
    session: TransportSession
  }
}

export interface TransportSessionRemovedEvent extends BaseEvent {
  type: typeof TransportEventTypes.TransportSessionRemoved
  payload: {
    session: TransportSession
  }
}
