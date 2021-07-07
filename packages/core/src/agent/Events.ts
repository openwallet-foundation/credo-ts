export enum AgentEventTypes {
  AgentMessageReceived = 'AgentMessageReceived',
}

export interface BaseEvent {
  type: string
  payload: Record<string, unknown>
}

export interface AgentMessageReceivedEvent extends BaseEvent {
  type: typeof AgentEventTypes.AgentMessageReceived
  payload: {
    message: unknown
  }
}
