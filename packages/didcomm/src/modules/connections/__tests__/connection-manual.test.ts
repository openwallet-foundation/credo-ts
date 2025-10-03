import type { DidCommConnectionStateChangedEvent } from '../DidCommConnectionEvents'

import { firstValueFrom } from 'rxjs'
import { filter, first, map, timeout } from 'rxjs/operators'

import { Agent } from '../../../../../core/src/agent/Agent'
import { setupSubjectTransports } from '../../../../../core/tests'
import { getAgentOptions } from '../../../../../core/tests/helpers'
import { DidCommConnectionEventTypes } from '../DidCommConnectionEvents'
import { DidCommConnectionsModule } from '../DidCommConnectionsModule'
import { DidCommDidExchangeState } from '../models'

function waitForRequest(agent: Agent, theirLabel: string) {
  return firstValueFrom(
    agent.events
      .observable<DidCommConnectionStateChangedEvent>(DidCommConnectionEventTypes.DidCommConnectionStateChanged)
      .pipe(
        map((event) => event.payload.connectionRecord),
        // Wait for request received
        filter(
          (connectionRecord) =>
            connectionRecord.state === DidCommDidExchangeState.RequestReceived &&
            connectionRecord.theirLabel === theirLabel
        ),
        first(),
        timeout(5000)
      )
  )
}

function waitForResponse(agent: Agent, connectionId: string) {
  return firstValueFrom(
    agent.events
      .observable<DidCommConnectionStateChangedEvent>(DidCommConnectionEventTypes.DidCommConnectionStateChanged)
      .pipe(
        // Wait for response received
        map((event) => event.payload.connectionRecord),
        filter(
          (connectionRecord) =>
            connectionRecord.state === DidCommDidExchangeState.ResponseReceived && connectionRecord.id === connectionId
        ),
        first(),
        timeout(5000)
      )
  )
}

describe('Manual Connection Flow', () => {
  // This test was added to reproduce a bug where all connections based on a reusable invitation would use the same keys
  // This was only present in the manual flow, which is almost never used.
  it('can connect multiple times using the same reusable invitation without manually using the connections api', async () => {
    const aliceAgentOptions = getAgentOptions(
      'Manual Connection Flow Alice',
      {
        endpoints: ['rxjs:alice'],
      },
      {},
      {
        connections: new DidCommConnectionsModule({
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
      {},
      {
        connections: new DidCommConnectionsModule({
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
        connections: new DidCommConnectionsModule({
          autoAcceptConnections: false,
        }),
      },
      { requireDidcomm: true }
    )

    const aliceAgent = new Agent(aliceAgentOptions)
    const bobAgent = new Agent(bobAgentOptions)
    const faberAgent = new Agent(faberAgentOptions)

    setupSubjectTransports([aliceAgent, bobAgent, faberAgent])
    await aliceAgent.initialize()
    await bobAgent.initialize()
    await faberAgent.initialize()

    const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({
      autoAcceptConnection: false,
      multiUseInvitation: true,
      label: 'faber',
    })

    const waitForAliceRequest = waitForRequest(faberAgent, 'alice')
    const waitForBobRequest = waitForRequest(faberAgent, 'bob')

    let { connectionRecord: aliceConnectionRecord } = await aliceAgent.didcomm.oob.receiveInvitation(
      faberOutOfBandRecord.outOfBandInvitation,
      {
        label: 'alice',
        autoAcceptInvitation: true,
        autoAcceptConnection: false,
      }
    )

    let { connectionRecord: bobConnectionRecord } = await bobAgent.didcomm.oob.receiveInvitation(
      faberOutOfBandRecord.outOfBandInvitation,
      {
        label: 'bob',
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

    await faberAgent.didcomm.connections.acceptRequest(faberAliceConnectionRecord.id)
    await faberAgent.didcomm.connections.acceptRequest(faberBobConnectionRecord.id)

    aliceConnectionRecord = await waitForAliceResponse
    await aliceAgent.didcomm.connections.acceptResponse(aliceConnectionRecord?.id)

    bobConnectionRecord = await waitForBobResponse
    await bobAgent.didcomm.connections.acceptResponse(bobConnectionRecord?.id)

    aliceConnectionRecord = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceConnectionRecord?.id)
    bobConnectionRecord = await bobAgent.didcomm.connections.returnWhenIsConnected(bobConnectionRecord?.id)
    faberAliceConnectionRecord = await faberAgent.didcomm.connections.returnWhenIsConnected(
      faberAliceConnectionRecord?.id
    )
    faberBobConnectionRecord = await faberAgent.didcomm.connections.returnWhenIsConnected(faberBobConnectionRecord?.id)

    expect(aliceConnectionRecord).toBeConnectedWith(faberAliceConnectionRecord)
    expect(bobConnectionRecord).toBeConnectedWith(faberBobConnectionRecord)

    await aliceAgent.shutdown()
    await bobAgent.shutdown()
    await faberAgent.shutdown()
  })
})
