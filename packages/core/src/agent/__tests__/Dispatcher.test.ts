import type { Handler } from '../Handler'

import { getAgentConfig } from '../../../tests/helpers'
import { parseMessageType } from '../../utils/messageType'
import { AgentMessage } from '../AgentMessage'
import { Dispatcher } from '../Dispatcher'
import { EventEmitter } from '../EventEmitter'
import { MessageSender } from '../MessageSender'

class ConnectionInvitationTestMessage extends AgentMessage {
  public static readonly type = parseMessageType('https://didcomm.org/connections/1.0/invitation')
}
class ConnectionRequestTestMessage extends AgentMessage {
  public static readonly type = parseMessageType('https://didcomm.org/connections/1.0/request')
}

class ConnectionResponseTestMessage extends AgentMessage {
  public static readonly type = parseMessageType('https://didcomm.org/connections/1.0/response')
}

class NotificationAckTestMessage extends AgentMessage {
  public static readonly type = parseMessageType('https://didcomm.org/notification/1.0/ack')
}
class CredentialProposalTestMessage extends AgentMessage {
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/1.0/credential-proposal')
}

class TestHandler implements Handler {
  // We want to pass various classes to test various behaviours so we dont need to strictly type it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public constructor(classes: any[]) {
    this.supportedMessages = classes
  }

  public supportedMessages

  // We don't need an implementation in test handler so we can disable lint.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public async handle() {}
}

describe('Dispatcher', () => {
  const agentConfig = getAgentConfig('DispatcherTest')
  const MessageSenderMock = MessageSender as jest.Mock<MessageSender>
  const eventEmitter = new EventEmitter(agentConfig)

  const dispatcher = new Dispatcher(new MessageSenderMock(), eventEmitter, agentConfig)

  dispatcher.registerHandler(
    new TestHandler([ConnectionInvitationTestMessage, ConnectionRequestTestMessage, ConnectionResponseTestMessage])
  )
  dispatcher.registerHandler(new TestHandler([NotificationAckTestMessage]))
  dispatcher.registerHandler(new TestHandler([CredentialProposalTestMessage]))

  describe('supportedMessageTypes', () => {
    test('return all supported message types URIs', async () => {
      const messageTypes = dispatcher.supportedMessageTypes

      expect(messageTypes).toEqual([
        { messageTypeUri: 'https://didcomm.org/connections/1.0/invitation' },
        { messageTypeUri: 'https://didcomm.org/connections/1.0/request' },
        { messageTypeUri: 'https://didcomm.org/connections/1.0/response' },
        { messageTypeUri: 'https://didcomm.org/notification/1.0/ack' },
        { messageTypeUri: 'https://didcomm.org/issue-credential/1.0/credential-proposal' },
      ])
    })
  })

  describe('supportedProtocols', () => {
    test('return all supported message protocols URIs', async () => {
      const messageTypes = dispatcher.supportedProtocols

      expect(messageTypes).toEqual([
        'https://didcomm.org/connections/1.0',
        'https://didcomm.org/notification/1.0',
        'https://didcomm.org/issue-credential/1.0',
      ])
    })
  })

  describe('filterSupportedProtocolsByMessageFamilies', () => {
    it('should return empty array when input is empty array', async () => {
      const supportedProtocols = dispatcher.filterSupportedProtocolsByMessageFamilies([])
      expect(supportedProtocols).toEqual([])
    })

    it('should return empty array when input contains only unsupported protocol', async () => {
      const supportedProtocols = dispatcher.filterSupportedProtocolsByMessageFamilies([
        'https://didcomm.org/unsupported-protocol/1.0',
      ])
      expect(supportedProtocols).toEqual([])
    })

    it('should return array with only supported protocol when input contains supported and unsupported protocol', async () => {
      const supportedProtocols = dispatcher.filterSupportedProtocolsByMessageFamilies([
        'https://didcomm.org/connections',
        'https://didcomm.org/didexchange',
      ])
      expect(supportedProtocols).toEqual(['https://didcomm.org/connections/1.0'])
    })
  })
})
