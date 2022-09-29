import type { BaseEvent } from '../agent/Events'

export enum TransportEventTypes {
  OutboundWebSocketOpenedEvent = 'OutboundWebSocketOpenedEvent',
  OutboundWebSocketClosedEvent = 'OutboundWebSocketClosedEvent',
}

export interface OutboundWebSocketOpenedEvent extends BaseEvent {
  type: TransportEventTypes.OutboundWebSocketOpenedEvent
  payload: {
    socketId: string
    did?: string
    connectionId?: string
  }
}

export interface OutboundWebSocketClosedEvent extends BaseEvent {
  type: TransportEventTypes.OutboundWebSocketClosedEvent
  payload: {
    socketId: string
    did?: string
    connectionId?: string
  }
}
