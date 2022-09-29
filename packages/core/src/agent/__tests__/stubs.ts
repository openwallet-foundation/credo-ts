import type { ConnectionRecord } from '../../modules/connections'
import type { TransportSession } from '../TransportService'
import type { PackMessageParams } from '../didcomm/EnvelopeService'
import type { DIDCommV1Message } from '../didcomm/v1/DIDCommV1Message'

export class DummyTransportSession implements TransportSession {
  public id: string
  public readonly type = 'http'
  public keys?: PackMessageParams
  public inboundMessage?: DIDCommV1Message
  public connection?: ConnectionRecord

  public constructor(id: string) {
    this.id = id
  }

  public send(): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
