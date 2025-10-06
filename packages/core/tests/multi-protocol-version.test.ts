import type { DidCommMessageProcessedEvent } from '../../didcomm/src'

import { filter, firstValueFrom, timeout } from 'rxjs'

import {
  DidCommEventTypes,
  DidCommMessage,
  DidCommMessageSender,
  DidCommOutboundMessageContext,
  IsValidMessageType,
  parseMessageType,
} from '../../didcomm/src'
import { Agent } from '../src/agent/Agent'

import { getAgentOptions } from './helpers'
import { setupSubjectTransports } from './transport'

const aliceAgentOptions = getAgentOptions(
  'Multi Protocol Versions - Alice',
  {
    endpoints: ['rxjs:alice'],
  },
  undefined,
  undefined,
  { requireDidcomm: true }
)
const bobAgentOptions = getAgentOptions(
  'Multi Protocol Versions - Bob',
  {
    endpoints: ['rxjs:bob'],
  },
  undefined,
  undefined,
  { requireDidcomm: true }
)

describe('multi version protocols', () => {
  let aliceAgent: Agent
  let bobAgent: Agent

  afterAll(async () => {
    await bobAgent.shutdown()
    await aliceAgent.shutdown()
  })

  test('should successfully handle a message with a lower minor version than the currently supported version', async () => {
    bobAgent = new Agent(bobAgentOptions)
    aliceAgent = new Agent(aliceAgentOptions)
    setupSubjectTransports([aliceAgent, bobAgent])

    // Register the test handler with the v1.3 version of the message
    const mockHandle = jest.fn()
    aliceAgent.modules.didcomm.registerMessageHandlers([{ supportedMessages: [TestMessageV13], handle: mockHandle }])

    await aliceAgent.initialize()
    await bobAgent.initialize()

    const { outOfBandInvitation, id } = await aliceAgent.modules.oob.createInvitation()
    let { connectionRecord: bobConnection } = await bobAgent.modules.oob.receiveInvitation(outOfBandInvitation, {
      label: 'bob',
      autoAcceptConnection: true,
      autoAcceptInvitation: true,
    })

    if (!bobConnection) {
      throw new Error('No connection for bob')
    }

    bobConnection = await bobAgent.modules.connections.returnWhenIsConnected(bobConnection.id)

    let [aliceConnection] = await aliceAgent.modules.connections.findAllByOutOfBandId(id)
    aliceConnection = await aliceAgent.modules.connections.returnWhenIsConnected(aliceConnection.id)

    expect(aliceConnection).toBeConnectedWith(bobConnection)
    expect(bobConnection).toBeConnectedWith(aliceConnection)

    const bobMessageSender = bobAgent.dependencyManager.resolve(DidCommMessageSender)

    // Start event listener for message processed
    const agentMessageV11ProcessedPromise = firstValueFrom(
      aliceAgent.events.observable<DidCommMessageProcessedEvent>(DidCommEventTypes.DidCommMessageProcessed).pipe(
        filter((event) => event.payload.message.type === TestMessageV11.type.messageTypeUri),
        timeout(8000)
      )
    )

    await bobMessageSender.sendMessage(
      new DidCommOutboundMessageContext(new TestMessageV11(), {
        agentContext: bobAgent.context,
        connection: bobConnection,
      })
    )

    // Wait for the agent message processed event to be called
    await agentMessageV11ProcessedPromise

    expect(mockHandle).toHaveBeenCalledTimes(1)

    // Start event listener for message processed
    const agentMessageV15ProcessedPromise = firstValueFrom(
      aliceAgent.events.observable<DidCommMessageProcessedEvent>(DidCommEventTypes.DidCommMessageProcessed).pipe(
        filter((event) => event.payload.message.type === TestMessageV15.type.messageTypeUri),
        timeout(8000)
      )
    )

    await bobMessageSender.sendMessage(
      new DidCommOutboundMessageContext(new TestMessageV15(), {
        agentContext: bobAgent.context,
        connection: bobConnection,
      })
    )
    await agentMessageV15ProcessedPromise

    expect(mockHandle).toHaveBeenCalledTimes(2)
  })
})

class TestMessageV11 extends DidCommMessage {
  public constructor() {
    super()
    this.id = this.generateId()
  }

  @IsValidMessageType(TestMessageV11.type)
  public readonly type = TestMessageV11.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/custom-protocol/1.1/test-message')
}

class TestMessageV13 extends DidCommMessage {
  public constructor() {
    super()
    this.id = this.generateId()
  }

  @IsValidMessageType(TestMessageV13.type)
  public readonly type = TestMessageV13.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/custom-protocol/1.3/test-message')
}

class TestMessageV15 extends DidCommMessage {
  public constructor() {
    super()
    this.id = this.generateId()
  }

  @IsValidMessageType(TestMessageV15.type)
  public readonly type = TestMessageV15.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/custom-protocol/1.5/test-message')
}
