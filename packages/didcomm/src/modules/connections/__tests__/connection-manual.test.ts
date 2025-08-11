import type { ConnectionStateChangedEvent } from '../ConnectionEvents'

import { firstValueFrom } from 'rxjs'
import { filter, first, map, timeout } from 'rxjs/operators'

import { Agent } from '../../../../../core/src/agent/Agent'
import { setupSubjectTransports } from '../../../../../core/tests'
import { getAgentOptions } from '../../../../../core/tests/helpers'
import { ConnectionEventTypes } from '../ConnectionEvents'
import { ConnectionsModule } from '../ConnectionsModule'
import { DidExchangeState } from '../models'
import { OutOfBandRecord, OutOfBandState } from '../../oob'
import { MessageSender } from '../../../MessageSender'
import { MessageReceiver } from '../../../MessageReceiver'
import { ConnectionService } from '../services'

function waitForRequest(agent: Agent, theirLabel: string) {
  return firstValueFrom(
    agent.events.observable<ConnectionStateChangedEvent>(ConnectionEventTypes.ConnectionStateChanged).pipe(
      map((event) => event.payload.connectionRecord),
      // Wait for request received
      filter(
        (connectionRecord) =>
          connectionRecord.state === DidExchangeState.RequestReceived && connectionRecord.theirLabel === theirLabel
      ),
      first(),
      timeout(5000)
    )
  )
}

function waitForResponse(agent: Agent, connectionId: string) {
  return firstValueFrom(
    agent.events.observable<ConnectionStateChangedEvent>(ConnectionEventTypes.ConnectionStateChanged).pipe(
      // Wait for response received
      map((event) => event.payload.connectionRecord),
      filter(
        (connectionRecord) =>
          connectionRecord.state === DidExchangeState.ResponseReceived && connectionRecord.id === connectionId
      ),
      first(),
      timeout(5000)
    )
  )
}

const aliceAgentOptions = getAgentOptions(
  'Manual Connection Flow Alice',
  {
    endpoints: ['rxjs:alice'],
  },
  {
    label: 'alice',
  },
  {
    connections: new ConnectionsModule({
      autoAcceptConnections: false,
    }),
  },
  { requireDidcomm: true }
)

const bobAgentOptions = getAgentOptions(
  'Manual Connection Flow Bob',
  {
    endpoints: ['rxjs:bob'],
  },
  {
    label: 'bob',
  },
  {
    connections: new ConnectionsModule({
      autoAcceptConnections: false,
    }),
  },
  { requireDidcomm: true }
)

const faberAgentOptions = getAgentOptions(
  'Manual Connection Flow Faber',
  {
    endpoints: ['rxjs:faber'],
  },
  {},
  {
    connections: new ConnectionsModule({
      autoAcceptConnections: false,
    }),
  },
  { requireDidcomm: true }
)

describe('Manual Connection Flow', () => {
  let aliceAgent: Agent
  let bobAgent: Agent
  let faberAgent: Agent
  let aliceMessageSender: MessageSender
  let bobMessageReceiver: MessageReceiver

  beforeEach(async () => {
    aliceAgent = new Agent(aliceAgentOptions)
    bobAgent = new Agent(bobAgentOptions)
    faberAgent = new Agent(faberAgentOptions)

    setupSubjectTransports([aliceAgent, bobAgent, faberAgent])

    await aliceAgent.initialize()
    await bobAgent.initialize()
    await faberAgent.initialize()
    aliceMessageSender = aliceAgent.dependencyManager.resolve(MessageSender)
    bobMessageReceiver = bobAgent.dependencyManager.resolve(MessageReceiver)
  })

  afterEach(async () => {
    await aliceAgent.shutdown()
    await bobAgent.shutdown()
    await faberAgent.shutdown()
  })

  // This test was added to reproduce a bug where all connections based on a reusable invitation would use the same keys
  // This was only present in the manual flow, which is almost never used.
  it('can connect multiple times using the same reusable invitation without manually using the connections api', async () => {
    const faberOutOfBandRecord = await faberAgent.modules.oob.createInvitation({
      autoAcceptConnection: false,
      multiUseInvitation: true,
    })

    const waitForAliceRequest = waitForRequest(faberAgent, 'alice')
    const waitForBobRequest = waitForRequest(faberAgent, 'bob')

    let { connectionRecord: aliceConnectionRecord } = await aliceAgent.modules.oob.receiveInvitation(
      faberOutOfBandRecord.outOfBandInvitation,
      {
        autoAcceptInvitation: true,
        autoAcceptConnection: false,
      }
    )

    let { connectionRecord: bobConnectionRecord } = await bobAgent.modules.oob.receiveInvitation(
      faberOutOfBandRecord.outOfBandInvitation,
      {
        autoAcceptInvitation: true,
        autoAcceptConnection: false,
      }
    )

    let faberAliceConnectionRecord = await waitForAliceRequest
    let faberBobConnectionRecord = await waitForBobRequest

    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    const waitForAliceResponse = waitForResponse(aliceAgent, aliceConnectionRecord?.id!)
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    const waitForBobResponse = waitForResponse(bobAgent, bobConnectionRecord?.id!)

    await faberAgent.modules.connections.acceptRequest(faberAliceConnectionRecord.id)
    await faberAgent.modules.connections.acceptRequest(faberBobConnectionRecord.id)

    aliceConnectionRecord = await waitForAliceResponse
    await aliceAgent.modules.connections.acceptResponse(aliceConnectionRecord?.id)

    bobConnectionRecord = await waitForBobResponse
    await bobAgent.modules.connections.acceptResponse(bobConnectionRecord?.id)

    aliceConnectionRecord = await aliceAgent.modules.connections.returnWhenIsConnected(aliceConnectionRecord?.id)
    bobConnectionRecord = await bobAgent.modules.connections.returnWhenIsConnected(bobConnectionRecord?.id)
    faberAliceConnectionRecord = await faberAgent.modules.connections.returnWhenIsConnected(
      faberAliceConnectionRecord?.id
    )
    faberBobConnectionRecord = await faberAgent.modules.connections.returnWhenIsConnected(faberBobConnectionRecord?.id)

    expect(aliceConnectionRecord).toBeConnectedWith(faberAliceConnectionRecord)
    expect(bobConnectionRecord).toBeConnectedWith(faberBobConnectionRecord)
  })

  it.only('allows a party to decline an incoming connection request', async () => {
    const aliceSpy = jest.spyOn(aliceMessageSender, 'sendMessage')
    const bobSpy = jest.spyOn(bobMessageReceiver, 'receiveMessage')
    const bobSpy2 = jest.spyOn(bobMessageReceiver as any, 'transformAndValidate')
    // const bobConnectionService = bobAgent.dependencyManager.resolve(ConnectionService)
    // const bobConnectionSpy = jest.spyOn(bobConnectionService, 'processProblemReport')

    // Alice creates an OOB invitation
    const aliceOutOfBandRecord: OutOfBandRecord = await aliceAgent.modules.oob.createInvitation({
      autoAcceptConnection: false,
    })

    // Bob receives the invitation and initiates a connection
    const {
      outOfBandRecord: bobOutOfBandRecord,
      connectionRecord: bobConnectionRecord,
    } = await bobAgent.modules.oob.receiveInvitation(
      aliceOutOfBandRecord.outOfBandInvitation,
        {
          autoAcceptInvitation: true,
          autoAcceptConnection: false,
        }
      )

    // Bob's internal state should reflect waiting for a response
    expect(bobOutOfBandRecord.state).toBe(OutOfBandState.PrepareResponse)
    expect(bobConnectionRecord.state).toBe(DidExchangeState.RequestSent)

    // Alice should receive the connection request and her state should reflect this
    const aliceConnectionRecord = await waitForRequest(aliceAgent, 'bob')
    expect(aliceConnectionRecord.state).toBe(DidExchangeState.RequestReceived)

    // Now Alice declines the request
    const aliceConnectionAfterDecline = await aliceAgent.modules.connections.declineRequest(aliceConnectionRecord.id)

    // Alice should send the problem report correctly
    expect(aliceSpy).toHaveBeenCalled()
    const [aliceMessage] = aliceSpy.mock.calls[0]
    expect(aliceMessage.message.type).toBe('https://didcomm.org/connection/1.0/problem-report')
    expect(aliceMessage.message).toMatchObject({
      description: { en: expect.stringContaining('Connection request declined') }
    })

    // Alice's agent reflects this in her OOB record and connection record
    expect(aliceConnectionAfterDecline.state).toBe(DidExchangeState.Abandoned)
    const aliceOobAfterDecline = await aliceAgent.modules.oob.findById(aliceOutOfBandRecord.id)
    expect(aliceOobAfterDecline.state).toBe(OutOfBandState.Done)

    // Bob should receive the problem report correctly
    expect(bobSpy).toHaveBeenCalled()
    const [bobMessage] = bobSpy.mock.calls[0]

    expect(bobSpy2).toHaveBeenCalled()
    const [spy2] = bobSpy2.mock.calls
    // expect(bobConnectionSpy).toHaveBeenCalled()
    // const [spyMessage] = bobConnectionSpy.mock.calls[0]
    
    console.debug(aliceMessage)
    console.log(bobMessage)
    console.log(spy2)





    // const a = await waitForAgentMessageProcessedEvent(bobAgent, {
    //   messageType: ConnectionProblemReportMessage.type.messageTypeUri,
    //   threadId: aliceConnectionRecord.threadId
    // })

    // const bobConnectionAfterDecline = await bobAgent.modules.connections.getById(bobConnectionRecord.id)
    // expect(bobConnectionAfterDecline.state).toBe(DidExchangeState.Abandoned)

    // const bobOOB = await bobAgent.modules.oob.findById(bobOutOfBandRecord.id)
    // expect(bobOOB.state).toBe(OutOfBandState.Done)
  })
})
