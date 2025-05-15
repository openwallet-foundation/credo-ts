import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { ConnectionRecord, InboundMessageContext } from '../../didcomm'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import {
  AgentMessage,
  BasicMessage,
  MessageSender,
  TrustPingResponseMessage,
  getOutboundMessageContext,
} from '../../didcomm/src'
import { Agent, JsonTransformer } from '../src'

import { getAgentOptions, makeConnection, waitForAgentMessageProcessedEvent, waitForBasicMessage } from './helpers'

const faberAgent = new Agent(
  getAgentOptions(
    'Faber Message Handler Middleware',
    {
      endpoints: ['rxjs:faber'],
    },
    undefined,
    undefined,
    { requireDidcomm: true }
  )
)

const aliceAgent = new Agent(
  getAgentOptions(
    'Alice Message Handler Middleware',
    {
      endpoints: ['rxjs:alice'],
    },
    undefined,
    undefined,
    { requireDidcomm: true }
  )
)

describe('Message Handler Middleware E2E', () => {
  let faberConnection: ConnectionRecord
  let _aliceConnection: ConnectionRecord

  beforeEach(async () => {
    const faberMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()
    const subjectMap = {
      'rxjs:faber': faberMessages,
      'rxjs:alice': aliceMessages,
    }

    faberAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()

    aliceAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()
    ;[_aliceConnection, faberConnection] = await makeConnection(aliceAgent, faberAgent)
  })

  afterEach(async () => {
    await faberAgent.shutdown()
    await aliceAgent.shutdown()
  })

  test('Correctly calls the fallback message handler if no message handler is defined', async () => {
    // Fallback message handler
    aliceAgent.modules.didcomm.setFallbackMessageHandler((messageContext) => {
      return getOutboundMessageContext(messageContext.agentContext, {
        connectionRecord: messageContext.connection,
        message: new BasicMessage({
          content: "Hey there, I'm not sure I understand the message you sent to me",
        }),
      })
    })

    const message = JsonTransformer.fromJSON(
      {
        '@type': 'https://credo.js.org/custom-messaging/1.0/say-hello',
        '@id': 'b630b69a-2b82-4764-87ba-56aa2febfb97',
      },
      AgentMessage
    )

    // Send a custom message
    const messageSender = faberAgent.dependencyManager.resolve(MessageSender)
    const outboundMessageContext = await getOutboundMessageContext(faberAgent.context, {
      connectionRecord: faberConnection,
      message,
    })
    await messageSender.sendMessage(outboundMessageContext)

    // Expect the basic message sent by the fallback message handler
    await waitForBasicMessage(faberAgent, {
      content: "Hey there, I'm not sure I understand the message you sent to me",
    })
  })

  test('Correctly calls the registered message handler middleware', async () => {
    aliceAgent.modules.didcomm.registerMessageHandlerMiddleware(
      async (inboundMessageContext: InboundMessageContext, next) => {
        await next()

        if (inboundMessageContext.responseMessage) {
          inboundMessageContext.responseMessage.message.setTiming({
            outTime: new Date('2021-01-01'),
          })
        }
      }
    )

    await faberAgent.modules.connections.sendPing(faberConnection.id, {})
    const receiveMessage = await waitForAgentMessageProcessedEvent(faberAgent, {
      messageType: TrustPingResponseMessage.type.messageTypeUri,
    })

    // Should have sent the message with the timing added in the middleware
    expect(receiveMessage.timing?.outTime).toEqual(new Date('2021-01-01'))
  })
})
