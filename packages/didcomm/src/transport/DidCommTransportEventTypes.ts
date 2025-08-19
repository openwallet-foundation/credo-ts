import type { BaseEvent } from '@credo-ts/core'
import type { DidCommTransportSession } from '../DidCommTransportService'

export enum DidCommTransportEventTypes {
  DidCommOutboundWebSocketClosedEvent = 'DidCommOutboundWebSocketClosedEvent',
  DidCommOutboundWebSocketOpenedEvent = 'DidCommOutboundWebSocketOpenedEvent',
  DidCommTransportSessionSaved = 'DidCommTransportSessionSaved',
  DidCommTransportSessionRemoved = 'DidCommTransportSessionRemoved',
}

export interface DidCommOutboundWebSocketClosedEvent extends BaseEvent {
  type: DidCommTransportEventTypes.DidCommOutboundWebSocketClosedEvent
  payload: {
    socketId: string
    connectionId?: string
  }
}

export interface DidCommOutboundWebSocketOpenedEvent extends BaseEvent {
  type: DidCommTransportEventTypes.DidCommOutboundWebSocketOpenedEvent
  payload: {
    socketId: string
    connectionId?: string
  }
}

export interface TransportSessionSavedEvent extends BaseEvent {
  type: typeof DidCommTransportEventTypes.DidCommTransportSessionSaved
  payload: {
    session: DidCommTransportSession
  }
}

export interface TransportSessionRemovedEvent extends BaseEvent {
  type: typeof DidCommTransportEventTypes.DidCommTransportSessionRemoved
  payload: {
    session: DidCommTransportSession
  }
}
