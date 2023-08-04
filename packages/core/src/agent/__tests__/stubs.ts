import type { AgentBaseMessage } from '../AgentBaseMessage'
import type { TransportSession, SessionKeys } from '../TransportService'

export class DummyTransportSession implements TransportSession {
  public id: string
  public readonly type = 'http'
  public keys?: SessionKeys
  public inboundMessage?: AgentBaseMessage
  public connectionId?: string

  public constructor(id: string) {
    this.id = id
  }

  public send(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public close(): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
