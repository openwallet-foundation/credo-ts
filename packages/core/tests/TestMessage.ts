import { DidCommV1Message } from '../src/didcomm'

export class TestMessage extends DidCommV1Message {
  public constructor() {
    super()

    this.id = this.generateId()
  }

  public type = 'https://didcomm.org/connections/1.0/invitation'
}
