import type { MockedClassConstructor } from '../../../../../../tests/types'
import { EventEmitter } from '../../../../../core/src/agent/EventEmitter'
import { JsonEncoder } from '../../../../../core/src/utils/JsonEncoder'
import { getAgentContext, getMockConnection } from '../../../../../core/tests/helpers'
import { DidCommProblemReportError } from '../../../errors'
import { DidCommInboundMessageContext, DidCommProblemReportReason } from '../../../models'
import { DidCommTrustPingEventTypes } from '../DidCommTrustPingEvents'
import { DidCommTrustPingMessageHandler, DidCommTrustPingResponseMessageHandler } from '../handlers'
import {
  DidCommTrustPingMessage,
  DidCommTrustPingResponseMessage,
  DidCommTrustPingResponseV2Message,
  DidCommTrustPingV2Message,
} from '../messages'
import { DidCommDidExchangeRole, DidCommDidExchangeState } from '../models'
import { DidCommConnectionService, DidCommTrustPingService } from '../services'

vi.mock('../../../../../core/src/agent/EventEmitter')
vi.mock('../services/DidCommConnectionService')
const EventEmitterMock = EventEmitter as MockedClassConstructor<typeof EventEmitter>
const ConnectionServiceMock = DidCommConnectionService as MockedClassConstructor<typeof DidCommConnectionService>

const agentContext = getAgentContext()

const v1EncryptedMessage = {
  protected: JsonEncoder.toBase64Url({ enc: 'xchacha20poly1305_ietf', typ: 'JWM/1.0', alg: 'Authcrypt' }),
  iv: 'iv',
  ciphertext: 'ciphertext',
  tag: 'tag',
}

const v2EncryptedMessage = {
  protected: JsonEncoder.toBase64Url({ alg: 'ECDH-1PU+A256KW', enc: 'A256CBC-HS512' }),
  recipients: [],
  iv: 'iv',
  ciphertext: 'ciphertext',
  tag: 'tag',
}

describe('DidCommTrustPingService', () => {
  let eventEmitter: EventEmitter
  let connectionService: DidCommConnectionService
  let trustPingHandler: DidCommTrustPingMessageHandler
  let trustPingResponseHandler: DidCommTrustPingResponseMessageHandler

  beforeEach(() => {
    eventEmitter = new EventEmitterMock()
    connectionService = new ConnectionServiceMock()
    const trustPingService = new DidCommTrustPingService(eventEmitter)
    trustPingHandler = new DidCommTrustPingMessageHandler(trustPingService, connectionService)
    trustPingResponseHandler = new DidCommTrustPingResponseMessageHandler(trustPingService)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('ping', () => {
    it('answers a trust ping 2.0 on a v2 connection with a 2.0 ping-response', async () => {
      const connection = getMockConnection({ state: DidCommDidExchangeState.Completed, didcommVersion: 'v2' })
      const ping = new DidCommTrustPingV2Message({})

      const outboundMessageContext = await trustPingHandler.handle(
        new DidCommInboundMessageContext(ping, { agentContext, connection, encryptedMessage: v2EncryptedMessage })
      )

      expect(outboundMessageContext?.message).toBeInstanceOf(DidCommTrustPingResponseV2Message)
      expect(outboundMessageContext?.message.threadId).toBe(ping.id)
      expect(eventEmitter.emit).toHaveBeenCalledWith(agentContext, {
        type: DidCommTrustPingEventTypes.DidCommTrustPingReceivedEvent,
        payload: { connectionRecord: connection, message: ping },
      })
    })

    it('answers a trust ping 1.0 on a v1 connection with a 1.0 ping_response', async () => {
      const connection = getMockConnection({ state: DidCommDidExchangeState.Completed })
      const ping = new DidCommTrustPingMessage({})

      const outboundMessageContext = await trustPingHandler.handle(
        new DidCommInboundMessageContext(ping, { agentContext, connection, encryptedMessage: v1EncryptedMessage })
      )

      expect(outboundMessageContext?.message).toBeInstanceOf(DidCommTrustPingResponseMessage)
      expect(outboundMessageContext?.message.threadId).toBe(ping.id)
    })

    it('does not answer a trust ping 2.0 with response_requested false', async () => {
      const connection = getMockConnection({ state: DidCommDidExchangeState.Completed, didcommVersion: 'v2' })
      const ping = new DidCommTrustPingV2Message({ responseRequested: false })

      const outboundMessageContext = await trustPingHandler.handle(
        new DidCommInboundMessageContext(ping, { agentContext, connection })
      )

      expect(outboundMessageContext).toBeUndefined()
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1)
    })

    it.each([
      ['a trust ping 1.0 on a v2 connection', new DidCommTrustPingMessage({}), 'v2', v2EncryptedMessage],
      ['a trust ping 2.0 on a v1 connection', new DidCommTrustPingV2Message({}), 'v1', v1EncryptedMessage],
      [
        'a trust ping 2.0 in a v1 envelope on a v2 connection',
        new DidCommTrustPingV2Message({}),
        'v2',
        v1EncryptedMessage,
      ],
      [
        'a trust ping 1.0 in a v2 envelope on a v1 connection',
        new DidCommTrustPingMessage({}),
        'v1',
        v2EncryptedMessage,
      ],
    ] as const)('rejects %s', async (_, ping, didcommVersion, encryptedMessage) => {
      const connection = getMockConnection({ state: DidCommDidExchangeState.Completed, didcommVersion })

      const handle = trustPingHandler.handle(
        new DidCommInboundMessageContext(ping, { agentContext, connection, encryptedMessage })
      )

      await expect(handle).rejects.toThrow(DidCommProblemReportError)
      await expect(handle).rejects.toMatchObject({
        problemReport: { description: { code: DidCommProblemReportReason.MessageParseFailure } },
      })
      expect(eventEmitter.emit).not.toHaveBeenCalled()
    })

    it('does not complete a ResponseSent v1 connection when it rejects the ping', async () => {
      const connection = getMockConnection({
        state: DidCommDidExchangeState.ResponseSent,
        role: DidCommDidExchangeRole.Responder,
      })

      await expect(
        trustPingHandler.handle(
          new DidCommInboundMessageContext(new DidCommTrustPingV2Message({}), { agentContext, connection })
        )
      ).rejects.toThrow(DidCommProblemReportError)
      expect(connectionService.updateState).not.toHaveBeenCalled()
    })
  })

  describe('ping-response', () => {
    it('emits a 2.0 ping-response received on a v2 connection', async () => {
      const connection = getMockConnection({ state: DidCommDidExchangeState.Completed, didcommVersion: 'v2' })
      const response = new DidCommTrustPingResponseV2Message({ threadId: 'ping-id' })

      await trustPingResponseHandler.handle(new DidCommInboundMessageContext(response, { agentContext, connection }))

      expect(eventEmitter.emit).toHaveBeenCalledWith(agentContext, {
        type: DidCommTrustPingEventTypes.DidCommTrustPingResponseReceivedEvent,
        payload: { connectionRecord: connection, message: response },
      })
    })

    it.each([
      ['a 1.0 ping_response on a v2 connection', new DidCommTrustPingResponseMessage({ threadId: 'ping-id' }), 'v2'],
      ['a 2.0 ping-response on a v1 connection', new DidCommTrustPingResponseV2Message({ threadId: 'ping-id' }), 'v1'],
    ] as const)('rejects %s', async (_, response, didcommVersion) => {
      const connection = getMockConnection({ state: DidCommDidExchangeState.Completed, didcommVersion })

      await expect(
        trustPingResponseHandler.handle(new DidCommInboundMessageContext(response, { agentContext, connection }))
      ).rejects.toThrow(DidCommProblemReportError)
      expect(eventEmitter.emit).not.toHaveBeenCalled()
    })
  })
})
