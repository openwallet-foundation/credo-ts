import { AgentMessage } from '../src/agent/AgentMessage'

export class TestMessage extends AgentMessage {
  public constructor() {
    super()

    this.id = this.generateId()
  }

  public type = 'https://didcomm.org/connections/1.0/invitation'
}
