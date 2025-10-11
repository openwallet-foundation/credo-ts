import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { DidCommConnectionRecord, DidCommInboundMessageContext } from '../../didcomm/src/index'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import {
  DidCommBasicMessage,
  DidCommMessage,
  DidCommMessageSender,
  DidCommTrustPingResponseMessage,
  getOutboundDidCommMessageContext,
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
  let faberConnection: DidCommConnectionRecord
  let _aliceConnection: DidCommConnectionRecord

  beforeEach(async () => {
    const faberMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()
    const subjectMap = {
      'rxjs:faber': faberMessages,
      'rxjs:alice': aliceMessages,
    }

    faberAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()

    aliceAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()
    ;[_aliceConnection, faberConnection] = await makeConnection(aliceAgent, faberAgent)
  })

  afterEach(async () => {
    await faberAgent.shutdown()
    await aliceAgent.shutdown()
  })

  test('Correctly calls the fallback message handler if no message handler is defined', async () => {
    // Fallback message handler
    aliceAgent.didcomm.setFallbackMessageHandler((messageContext) => {
      return getOutboundDidCommMessageContext(messageContext.agentContext, {
        connectionRecord: messageContext.connection,
        message: new DidCommBasicMessage({
          content: "Hey there, I'm not sure I understand the message you sent to me",
        }),
      })
    })

    const message = JsonTransformer.fromJSON(
      {
        '@type': 'https://credo.js.org/custom-messaging/1.0/say-hello',
        '@id': 'b630b69a-2b82-4764-87ba-56aa2febfb97',
      },
      DidCommMessage
    )

    // Send a custom message
    const messageSender = faberAgent.dependencyManager.resolve(DidCommMessageSender)
    const outboundMessageContext = await getOutboundDidCommMessageContext(faberAgent.context, {
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
    aliceAgent.didcomm.registerMessageHandlerMiddleware(
      async (inboundMessageContext: DidCommInboundMessageContext, next) => {
        await next()

        if (inboundMessageContext.responseMessage) {
          inboundMessageContext.responseMessage.message.setTiming({
            outTime: new Date('2021-01-01'),
          })
        }
      }
    )

    await faberAgent.didcomm.connections.sendPing(faberConnection.id, {})
    const receiveMessage = await waitForAgentMessageProcessedEvent(faberAgent, {
      messageType: DidCommTrustPingResponseMessage.type.messageTypeUri,
    })

    // Should have sent the message with the timing added in the middleware
    expect(receiveMessage.timing?.outTime).toEqual(new Date('2021-01-01'))
  })
})
