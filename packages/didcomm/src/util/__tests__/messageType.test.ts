import { DidCommMessage } from '../../DidCommMessage'
import {
  canHandleMessageType,
  parseDidCommProtocolUri,
  parseMessageType,
  supportsIncomingDidCommProtocolUri,
  supportsIncomingMessageType,
} from '../messageType'

export class TestMessage extends DidCommMessage {
  public constructor() {
    super()

    this.id = this.generateId()
  }

  public readonly type = TestMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/fake-protocol/1.5/invitation')
}

describe('messageType', () => {
  describe('parseMessageType()', () => {
    test('correctly parses the message type', () => {
      expect(parseMessageType('https://didcomm.org/connections/1.0/request')).toEqual({
        documentUri: 'https://didcomm.org',
        protocolName: 'connections',
        protocolVersion: '1.0',
        protocolMajorVersion: 1,
        protocolMinorVersion: 0,
        messageName: 'request',
        protocolUri: 'https://didcomm.org/connections/1.0',
        messageTypeUri: 'https://didcomm.org/connections/1.0/request',
      })

      expect(parseMessageType('https://didcomm.org/issue-credential/4.5/propose-credential')).toEqual({
        documentUri: 'https://didcomm.org',
        protocolName: 'issue-credential',
        protocolVersion: '4.5',
        protocolMajorVersion: 4,
        protocolMinorVersion: 5,
        messageName: 'propose-credential',
        protocolUri: 'https://didcomm.org/issue-credential/4.5',
        messageTypeUri: 'https://didcomm.org/issue-credential/4.5/propose-credential',
      })
    })

    test('throws error when invalid message type is passed', () => {
      expect(() => parseMessageType('https://didcomm.org/connections/1.0/message-type/and-else')).toThrow()
    })
  })

  describe('parseDidCommProtocolUri()', () => {
    test('correctly parses the protocol uri', () => {
      expect(parseDidCommProtocolUri('https://didcomm.org/connections/1.0')).toEqual({
        documentUri: 'https://didcomm.org',
        protocolName: 'connections',
        protocolVersion: '1.0',
        protocolMajorVersion: 1,
        protocolMinorVersion: 0,
        protocolUri: 'https://didcomm.org/connections/1.0',
      })

      expect(parseDidCommProtocolUri('https://didcomm.org/issue-credential/4.5')).toEqual({
        documentUri: 'https://didcomm.org',
        protocolName: 'issue-credential',
        protocolVersion: '4.5',
        protocolMajorVersion: 4,
        protocolMinorVersion: 5,
        protocolUri: 'https://didcomm.org/issue-credential/4.5',
      })
    })

    test('throws error when message type is passed', () => {
      expect(() => parseDidCommProtocolUri('https://didcomm.org/connections/1.0/message-type')).toThrow()
    })
  })

  describe('supportsIncomingDidCommProtocolUri()', () => {
    test('returns true when the document uri, protocol name, major version all match and the minor version is lower than the expected minor version', () => {
      const incomingProtocolUri = parseDidCommProtocolUri('https://didcomm.org/connections/1.0')
      const expectedProtocolUri = parseDidCommProtocolUri('https://didcomm.org/connections/1.4')

      expect(supportsIncomingDidCommProtocolUri(incomingProtocolUri, expectedProtocolUri)).toBe(true)
    })

    test('returns true when the document uri, protocol name, major version all match and the minor version is higher than the expected minor version', () => {
      const incomingProtocolUri = parseDidCommProtocolUri('https://didcomm.org/connections/1.8')
      const expectedProtocolUri = parseDidCommProtocolUri('https://didcomm.org/connections/1.4')

      expect(supportsIncomingDidCommProtocolUri(incomingProtocolUri, expectedProtocolUri)).toBe(true)
    })

    test('returns true when the document uri, protocol name, major version and minor version all match', () => {
      const incomingProtocolUri = parseDidCommProtocolUri('https://didcomm.org/connections/1.4')
      const expectedProtocolUri = parseDidCommProtocolUri('https://didcomm.org/connections/1.4')

      expect(supportsIncomingDidCommProtocolUri(incomingProtocolUri, expectedProtocolUri)).toBe(true)
    })

    test('returns false when the major version does not match', () => {
      const incomingProtocolUri = parseDidCommProtocolUri('https://didcomm.org/connections/2.4')
      const expectedProtocolUri = parseDidCommProtocolUri('https://didcomm.org/connections/1.4')

      expect(supportsIncomingDidCommProtocolUri(incomingProtocolUri, expectedProtocolUri)).toBe(false)

      const incomingProtocolUri2 = parseDidCommProtocolUri('https://didcomm.org/connections/2.0')
      const expectedProtocolUri2 = parseDidCommProtocolUri('https://didcomm.org/connections/1.4')

      expect(supportsIncomingDidCommProtocolUri(incomingProtocolUri2, expectedProtocolUri2)).toBe(false)
    })

    test('returns false when the protocol name does not match', () => {
      const incomingProtocolUri = parseDidCommProtocolUri('https://didcomm.org/issue-credential/1.4')
      const expectedProtocolUri = parseDidCommProtocolUri('https://didcomm.org/connections/1.4')

      expect(supportsIncomingDidCommProtocolUri(incomingProtocolUri, expectedProtocolUri)).toBe(false)
    })

    test('returns false when the document uri does not match', () => {
      const incomingProtocolUri = parseDidCommProtocolUri('https://my-protocol.org/connections/1.4')
      const expectedProtocolUri = parseDidCommProtocolUri('https://didcomm.org/connections/1.4')

      expect(supportsIncomingDidCommProtocolUri(incomingProtocolUri, expectedProtocolUri)).toBe(false)
    })
  })

  describe('supportsIncomingMessageType()', () => {
    test('returns true when the document uri, protocol name, major version all match and the minor version is lower than the expected minor version', () => {
      const incomingMessageType = parseMessageType('https://didcomm.org/connections/1.0/request')
      const expectedMessageType = parseMessageType('https://didcomm.org/connections/1.4/request')

      expect(supportsIncomingMessageType(incomingMessageType, expectedMessageType)).toBe(true)
    })

    test('returns true when the document uri, protocol name, major version all match and the minor version is higher than the expected minor version', () => {
      const incomingMessageType = parseMessageType('https://didcomm.org/connections/1.8/request')
      const expectedMessageType = parseMessageType('https://didcomm.org/connections/1.4/request')

      expect(supportsIncomingMessageType(incomingMessageType, expectedMessageType)).toBe(true)
    })

    test('returns true when the document uri, protocol name, major version and minor version all match', () => {
      const incomingMessageType = parseMessageType('https://didcomm.org/connections/1.4/request')
      const expectedMessageType = parseMessageType('https://didcomm.org/connections/1.4/request')

      expect(supportsIncomingMessageType(incomingMessageType, expectedMessageType)).toBe(true)
    })

    test('returns false when the major version does not match', () => {
      const incomingMessageType = parseMessageType('https://didcomm.org/connections/2.4/request')
      const expectedMessageType = parseMessageType('https://didcomm.org/connections/1.4/request')

      expect(supportsIncomingMessageType(incomingMessageType, expectedMessageType)).toBe(false)

      const incomingMessageType2 = parseMessageType('https://didcomm.org/connections/2.0/request')
      const expectedMessageType2 = parseMessageType('https://didcomm.org/connections/1.4/request')

      expect(supportsIncomingMessageType(incomingMessageType2, expectedMessageType2)).toBe(false)
    })

    test('returns false when the message name does not match', () => {
      const incomingMessageType = parseMessageType('https://didcomm.org/connections/1.4/proposal')
      const expectedMessageType = parseMessageType('https://didcomm.org/connections/1.4/request')

      expect(supportsIncomingMessageType(incomingMessageType, expectedMessageType)).toBe(false)
    })

    test('returns false when the protocol name does not match', () => {
      const incomingMessageType = parseMessageType('https://didcomm.org/issue-credential/1.4/request')
      const expectedMessageType = parseMessageType('https://didcomm.org/connections/1.4/request')

      expect(supportsIncomingMessageType(incomingMessageType, expectedMessageType)).toBe(false)
    })

    test('returns false when the document uri does not match', () => {
      const incomingMessageType = parseMessageType('https://my-protocol.org/connections/1.4/request')
      const expectedMessageType = parseMessageType('https://didcomm.org/connections/1.4/request')

      expect(supportsIncomingMessageType(incomingMessageType, expectedMessageType)).toBe(false)
    })
  })

  describe('canHandleMessageType()', () => {
    test('returns true when the document uri, protocol name, major version all match and the minor version is lower than the expected minor version', () => {
      expect(
        canHandleMessageType(TestMessage, parseMessageType('https://didcomm.org/fake-protocol/1.0/invitation'))
      ).toBe(true)
    })

    test('returns true when the document uri, protocol name, major version all match and the minor version is higher than the expected minor version', () => {
      expect(
        canHandleMessageType(TestMessage, parseMessageType('https://didcomm.org/fake-protocol/1.8/invitation'))
      ).toBe(true)
    })

    test('returns true when the document uri, protocol name, major version and minor version all match', () => {
      expect(
        canHandleMessageType(TestMessage, parseMessageType('https://didcomm.org/fake-protocol/1.5/invitation'))
      ).toBe(true)
    })

    test('returns false when the major version does not match', () => {
      expect(
        canHandleMessageType(TestMessage, parseMessageType('https://didcomm.org/fake-protocol/2.5/invitation'))
      ).toBe(false)

      expect(
        canHandleMessageType(TestMessage, parseMessageType('https://didcomm.org/fake-protocol/2.0/invitation'))
      ).toBe(false)
    })

    test('returns false when the message name does not match', () => {
      expect(canHandleMessageType(TestMessage, parseMessageType('https://didcomm.org/fake-protocol/1.5/request'))).toBe(
        false
      )
    })

    test('returns false when the protocol name does not match', () => {
      expect(
        canHandleMessageType(TestMessage, parseMessageType('https://didcomm.org/another-fake-protocol/1.5/invitation'))
      ).toBe(false)
    })

    test('returns false when the document uri does not match', () => {
      expect(
        canHandleMessageType(
          TestMessage,
          parseMessageType('https://another-didcomm-site.org/fake-protocol/1.5/invitation')
        )
      ).toBe(false)
    })
  })
})
