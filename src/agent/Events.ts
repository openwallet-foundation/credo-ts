export interface BaseEvent {
  type: string
}

export interface AgentMessageReceivedEvent extends BaseEvent {
  type: 'AgentMessageReceived'
  message: unknown
}
