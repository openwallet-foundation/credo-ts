import { DIDCommV1Message } from '../src/agent/didcomm'

export class TestMessage extends DIDCommV1Message {
  public constructor() {
    super()

    this.id = this.generateId()
  }

  public type = 'https://didcomm.org/connections/1.0/invitation'
}
