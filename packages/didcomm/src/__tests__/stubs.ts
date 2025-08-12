import type { DidCommMessage } from '../DidCommMessage'
import type { EnvelopeKeys } from '../DidCommEnvelopeService'
import type { DidCommTransportSession } from '../DidCommTransportService'

export class DummyTransportSession implements DidCommTransportSession {
  public id: string
  public readonly type = 'http'
  public keys?: EnvelopeKeys
  public inboundMessage?: DidCommMessage
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
