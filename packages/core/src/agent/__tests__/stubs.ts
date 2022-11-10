import type { ConnectionRecord } from '../../modules/connections'
import type { TransportSession } from '../TransportService'
import type { DIDCommMessage } from '../didcomm'
import type { PackMessageParams } from '../didcomm/EnvelopeService'

export class DummyTransportSession implements TransportSession {
  public id: string
  public readonly type = 'http'
  public keys?: PackMessageParams
  public inboundMessage?: DIDCommMessage
  public connection?: ConnectionRecord

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
