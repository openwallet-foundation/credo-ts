import { DidCommV1Message, DidCommV2Message } from '../src/didcomm'

export class TestMessage extends DidCommV1Message {
  public constructor() {
    super()

    this.id = this.generateId()
  }

  public type = 'https://didcomm.org/connections/1.0/invitation'
}

export class V2TestMessage extends DidCommV2Message {
  public constructor() {
    super()

    this.id = this.generateId()
    this.body = {}
  }

  public type = 'https://didcomm.org/connections/2.0/invitation'
}
