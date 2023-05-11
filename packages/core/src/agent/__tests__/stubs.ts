import type { PackMessageParams as DidCommV1PackMessageParams } from '../../didcomm/versions/v1'
import type { V2PackMessageParams as DidCommV2PackMessageParams } from '../../didcomm/versions/v2'
import type { AgentMessage } from '../AgentMessage'
import type { TransportSession } from '../TransportService'

export class DummyTransportSession implements TransportSession {
  public id: string
  public readonly type = 'http'
  public keys?: DidCommV1PackMessageParams | DidCommV2PackMessageParams
  public inboundMessage?: AgentMessage
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
