import {
  parseMessageType,
  replaceLegacyDidSovPrefix,
  replaceLegacyDidSovPrefixOnMessage,
  replaceNewDidCommPrefixWithLegacyDidSov,
  replaceNewDidCommPrefixWithLegacyDidSovOnMessage,
} from '../messageType'

describe('messageType', () => {
  describe('replaceLegacyDidSovPrefixOnMessage()', () => {
    it('should replace the message type prefix with https://didcomm.org if it starts with did:sov:BzCbsNYhMrjHiqZDTUASHg;spec', () => {
      const message = {
        '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/basicmessage/1.0/message',
      }

      replaceLegacyDidSovPrefixOnMessage(message)

      expect(message['@type']).toBe('https://didcomm.org/basicmessage/1.0/message')
    })

    it("should not replace the message type prefix with https://didcomm.org if it doesn't start with did:sov:BzCbsNYhMrjHiqZDTUASHg;spec", () => {
      const messageOtherDidSov = {
        '@type': 'did:sov:another_did;spec/basicmessage/1.0/message',
      }
      replaceLegacyDidSovPrefixOnMessage(messageOtherDidSov)
      expect(messageOtherDidSov['@type']).toBe('did:sov:another_did;spec/basicmessage/1.0/message')

      const messageDidComm = {
        '@type': 'https://didcomm.org/basicmessage/1.0/message',
      }
      replaceLegacyDidSovPrefixOnMessage(messageDidComm)
      expect(messageDidComm['@type']).toBe('https://didcomm.org/basicmessage/1.0/message')
    })
  })

  describe('replaceLegacyDidSovPrefix()', () => {
    it('should replace the message type prefix with https://didcomm.org if it starts with did:sov:BzCbsNYhMrjHiqZDTUASHg;spec', () => {
      const type = 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/basicmessage/1.0/message'

      expect(replaceLegacyDidSovPrefix(type)).toBe('https://didcomm.org/basicmessage/1.0/message')
    })

    it("should not replace the message type prefix with https://didcomm.org if it doesn't start with did:sov:BzCbsNYhMrjHiqZDTUASHg;spec", () => {
      const messageTypeOtherDidSov = 'did:sov:another_did;spec/basicmessage/1.0/message'

      expect(replaceLegacyDidSovPrefix(messageTypeOtherDidSov)).toBe(
        'did:sov:another_did;spec/basicmessage/1.0/message'
      )

      const messageTypeDidComm = 'https://didcomm.org/basicmessage/1.0/message'

      expect(replaceLegacyDidSovPrefix(messageTypeDidComm)).toBe('https://didcomm.org/basicmessage/1.0/message')
    })
  })

  describe('replaceNewDidCommPrefixWithLegacyDidSovOnMessage()', () => {
    it('should replace the message type prefix with did:sov:BzCbsNYhMrjHiqZDTUASHg;spec if it starts with https://didcomm.org', () => {
      const message = {
        '@type': 'https://didcomm.org/basicmessage/1.0/message',
      }

      replaceNewDidCommPrefixWithLegacyDidSovOnMessage(message)

      expect(message['@type']).toBe('did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/basicmessage/1.0/message')
    })
  })

  describe('replaceNewDidCommPrefixWithLegacyDidSov()', () => {
    it('should replace the message type prefix with did:sov:BzCbsNYhMrjHiqZDTUASHg;spec if it starts with https://didcomm.org', () => {
      const type = 'https://didcomm.org/basicmessage/1.0/message'

      expect(replaceNewDidCommPrefixWithLegacyDidSov(type)).toBe(
        'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/basicmessage/1.0/message'
      )
    })

    it("should not replace the message type prefix with did:sov:BzCbsNYhMrjHiqZDTUASHg;spec if it doesn't start with https://didcomm.org", () => {
      const messageTypeOtherDidSov = 'did:sov:another_did;spec/basicmessage/1.0/message'

      expect(replaceNewDidCommPrefixWithLegacyDidSov(messageTypeOtherDidSov)).toBe(
        'did:sov:another_did;spec/basicmessage/1.0/message'
      )
    })
  })

  describe('parseMessageType()', () => {
    test('correctly parses the message type', () => {
      expect(parseMessageType('https://didcomm.org/connections/1.0/request')).toEqual({
        documentUri: 'https://didcomm.org',
        protocolName: 'connections',
        protocolVersion: '1.0',
        messageName: 'request',
        protocolUri: `https://didcomm.org/connections/1.0`,
      })

      expect(parseMessageType('https://didcomm.org/issue-credential/1.0/propose-credential')).toEqual({
        documentUri: 'https://didcomm.org',
        protocolName: 'issue-credential',
        protocolVersion: '1.0',
        messageName: 'propose-credential',
        protocolUri: `https://didcomm.org/issue-credential/1.0`,
      })
    })
  })
})
