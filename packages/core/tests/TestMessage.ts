import { DIDCommV1Message } from '../src/agent/didcomm/v1/DIDCommV1Message'

export class TestMessage extends DIDCommV1Message {
  public constructor() {
    super()

    this.id = this.generateId()
  }

  public readonly type = 'https://didcomm.org/connections/1.0/invitation'
}
