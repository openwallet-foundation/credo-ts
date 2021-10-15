import type { BaseEvent } from '../agent/Events'

export enum TransportEventTypes {
  OutboundWebSocketClosedEvent = 'OutboundWebSocketClosedEvent',
}

export interface OutboundWebSocketClosedEvent extends BaseEvent {
  type: TransportEventTypes.OutboundWebSocketClosedEvent
  payload: {
    socketId: string
    connectionId?: string
  }
}
