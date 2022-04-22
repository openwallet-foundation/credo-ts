import type { ConnectionRecord } from '../../modules/connections'
import type { TransportSession } from '../TransportService'
import type { DIDCommV1Message } from '../didcomm/v1/AgentMessage'
import type { EnvelopeKeys } from '../didcomm/v1/EnvelopeService'

export class DummyTransportSession implements TransportSession {
  public id: string
  public readonly type = 'http'
  public keys?: EnvelopeKeys
  public inboundMessage?: DIDCommV1Message
  public connection?: ConnectionRecord

  public constructor(id: string) {
    this.id = id
  }

  public send(): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
