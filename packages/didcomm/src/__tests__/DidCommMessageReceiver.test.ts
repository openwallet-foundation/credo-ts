import type { AgentContextProvider } from '@credo-ts/core'
import { Subject } from 'rxjs'
import { EventEmitter } from '../../../core/src/agent/EventEmitter'
import { getAgentConfig, getAgentContext } from '../../../core/tests/helpers'
import type { DidCommDispatcher } from '../DidCommDispatcher'
import type { DidCommEnvelopeService } from '../DidCommEnvelopeService'
import { DidCommEventTypes } from '../DidCommEvents'
import { DidCommMessageHandlerRegistry } from '../DidCommMessageHandlerRegistry'
import { DidCommMessageReceiver } from '../DidCommMessageReceiver'
import type { DidCommMessageSender } from '../DidCommMessageSender'
import type { DidCommTransportService } from '../DidCommTransportService'
import { DidCommTrustPingMessage } from '../modules/connections/messages'
import type { DidCommConnectionService } from '../modules/connections/services'

describe('DidCommMessageReceiver', () => {
  const agentConfig = getAgentConfig('DidCommMessageReceiver')
  const encryptedMessage = { protected: 'base64url', iv: 'base64url', ciphertext: 'base64url', tag: 'base64url' }
  const trustPing = { '@type': DidCommTrustPingMessage.type.messageTypeUri, '@id': 'trust-ping-id' }

  let agentContext: ReturnType<typeof getAgentContext>
  let eventEmitter: EventEmitter
  let envelopeService: { unpackMessage: ReturnType<typeof vi.fn> }
  let dispatcher: { dispatch: ReturnType<typeof vi.fn> }
  let agentContextProvider: { getContextForInboundMessage: ReturnType<typeof vi.fn> }
  let receiver: DidCommMessageReceiver

  beforeEach(() => {
    agentContext = getAgentContext({ agentConfig })
    eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())
    envelopeService = { unpackMessage: vi.fn() }
    dispatcher = { dispatch: vi.fn() }
    agentContextProvider = { getContextForInboundMessage: vi.fn().mockResolvedValue(agentContext) }

    const messageHandlerRegistry = new DidCommMessageHandlerRegistry()
    messageHandlerRegistry.registerMessageHandler({ supportedMessages: [DidCommTrustPingMessage], handle: vi.fn() })

    receiver = new DidCommMessageReceiver(
      envelopeService as unknown as DidCommEnvelopeService,
      {} as DidCommTransportService,
      {} as DidCommMessageSender,
      { findByKeys: vi.fn().mockResolvedValue(null) } as unknown as DidCommConnectionService,
      dispatcher as unknown as DidCommDispatcher,
      messageHandlerRegistry,
      eventEmitter,
      agentContextProvider as unknown as AgentContextProvider,
      agentConfig.logger
    )
  })

  test('reports a message it cannot decrypt as unreadable', async () => {
    envelopeService.unpackMessage.mockRejectedValue(new Error('decryption failed'))
    const listener = vi.fn()
    eventEmitter.on(DidCommEventTypes.DidCommMessageProcessingFailed, listener)

    await expect(receiver.receiveMessageAndReportFailure(agentContext, encryptedMessage)).resolves.toBe('unreadable')
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ message: encryptedMessage }) })
    )
  })

  test('reports a message it cannot parse as unreadable', async () => {
    await expect(
      receiver.receiveMessageAndReportFailure(agentContext, { '@type': 'https://didcomm.org/unknown/1.0/message' })
    ).resolves.toBe('unreadable')
  })

  test('reports a message whose handling fails as failed', async () => {
    dispatcher.dispatch.mockRejectedValue(new Error('storage unavailable'))

    await expect(receiver.receiveMessageAndReportFailure(agentContext, trustPing)).resolves.toBe('failed')
  })

  test('reports a message it could not get an agent context for as failed', async () => {
    agentContextProvider.getContextForInboundMessage.mockRejectedValue(new Error('session acquire timeout'))

    await expect(receiver.receiveMessageAndReportFailure(agentContext, trustPing)).resolves.toBe('failed')
  })

  test('processes the message in the given agent context without opening or ending a session', async () => {
    const endSession = vi.spyOn(agentContext, 'endSession')

    await expect(receiver.receiveMessageAndReportFailure(agentContext, trustPing, { agentContext })).resolves.toBe(
      'processed'
    )
    expect(agentContextProvider.getContextForInboundMessage).not.toHaveBeenCalled()
    expect(endSession).not.toHaveBeenCalled()
    expect(dispatcher.dispatch).toHaveBeenCalledWith(expect.objectContaining({ agentContext }))
  })
})
