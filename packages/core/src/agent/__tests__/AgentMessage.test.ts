import { AgentMessage } from '../AgentMessage'

class TestMessage extends AgentMessage {
  public readonly type = 'https://didcomm.org/connections/1.0/invitation'
}

describe('AgentMessage', () => {
  describe('toJSON', () => {
    it('should only use did:sov message prefix if useLegacyDidSovPrefix is true', () => {
      const message = new TestMessage()

      const jsonDidComm = message.toJSON()
      expect(jsonDidComm['@type']).toBe('https://didcomm.org/connections/1.0/invitation')

      const jsonSov = message.toJSON({ useLegacyDidSovPrefix: true })
      expect(jsonSov['@type']).toBe('did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/connections/1.0/invitation')
    })
  })
})
