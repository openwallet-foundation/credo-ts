import { Agent } from '../agent/Agent'

export interface InboundTransporter {
  start(agent: Agent): Promise<void>
}
