/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { ConnectionStateChangedEvent } from '../ConnectionEvents'

import { firstValueFrom } from 'rxjs'
import { filter, first, map, timeout } from 'rxjs/operators'

import { SubjectInboundTransport } from '../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../tests/transport/SubjectOutboundTransport'
import { getAgentOptions } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { ConnectionEventTypes } from '../ConnectionEvents'
import { DidExchangeState } from '../models'

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

describe('Manual Connection Flow', () => {
  // This test was added to reproduce a bug where all connections based on a reusable invitation would use the same keys
  // This was only present in the manual flow, which is almost never used.
  it('can connect multiple times using the same reusable invitation without manually using the connections api', async () => {
    const aliceInboundTransport = new SubjectInboundTransport()
    const bobInboundTransport = new SubjectInboundTransport()
    const faberInboundTransport = new SubjectInboundTransport()

    const subjectMap = {
      'rxjs:faber': faberInboundTransport.ourSubject,
      'rxjs:alice': aliceInboundTransport.ourSubject,
      'rxjs:bob': bobInboundTransport.ourSubject,
    }
    const aliceAgentOptions = getAgentOptions('Manual Connection Flow Alice', {
      label: 'alice',
      autoAcceptConnections: false,
      endpoints: ['rxjs:alice'],
    })
    const bobAgentOptions = getAgentOptions('Manual Connection Flow Bob', {
      label: 'bob',
      autoAcceptConnections: false,
      endpoints: ['rxjs:bob'],
    })
    const faberAgentOptions = getAgentOptions('Manual Connection Flow Faber', {
      autoAcceptConnections: false,
      endpoints: ['rxjs:faber'],
    })

    const aliceAgent = new Agent(aliceAgentOptions)
    aliceAgent.registerInboundTransport(aliceInboundTransport)
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))

    const bobAgent = new Agent(bobAgentOptions)
    bobAgent.registerInboundTransport(bobInboundTransport)
    bobAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))

    const faberAgent = new Agent(faberAgentOptions)
    faberAgent.registerInboundTransport(faberInboundTransport)
    faberAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))

    await aliceAgent.initialize()
    await bobAgent.initialize()
    await faberAgent.initialize()

    const faberOutOfBandRecord = await faberAgent.oob.createInvitation({
      autoAcceptConnection: false,
      multiUseInvitation: true,
    })

    const waitForAliceRequest = waitForRequest(faberAgent, 'alice')
    const waitForBobRequest = waitForRequest(faberAgent, 'bob')

    let { connectionRecord: aliceConnectionRecord } = await aliceAgent.oob.receiveInvitation(
      faberOutOfBandRecord.outOfBandInvitation,
      {
        autoAcceptInvitation: true,
        autoAcceptConnection: false,
      }
    )

    let { connectionRecord: bobConnectionRecord } = await bobAgent.oob.receiveInvitation(
      faberOutOfBandRecord.outOfBandInvitation,
      {
        autoAcceptInvitation: true,
        autoAcceptConnection: false,
      }
    )

    let faberAliceConnectionRecord = await waitForAliceRequest
    let faberBobConnectionRecord = await waitForBobRequest

    const waitForAliceResponse = waitForResponse(aliceAgent, aliceConnectionRecord!.id)
    const waitForBobResponse = waitForResponse(bobAgent, bobConnectionRecord!.id)

    await faberAgent.connections.acceptRequest(faberAliceConnectionRecord.id)
    await faberAgent.connections.acceptRequest(faberBobConnectionRecord.id)

    aliceConnectionRecord = await waitForAliceResponse
    await aliceAgent.connections.acceptResponse(aliceConnectionRecord!.id)

    bobConnectionRecord = await waitForBobResponse
    await bobAgent.connections.acceptResponse(bobConnectionRecord!.id)

    aliceConnectionRecord = await aliceAgent.connections.returnWhenIsConnected(aliceConnectionRecord!.id)
    bobConnectionRecord = await bobAgent.connections.returnWhenIsConnected(bobConnectionRecord!.id)
    faberAliceConnectionRecord = await faberAgent.connections.returnWhenIsConnected(faberAliceConnectionRecord!.id)
    faberBobConnectionRecord = await faberAgent.connections.returnWhenIsConnected(faberBobConnectionRecord!.id)

    expect(aliceConnectionRecord).toBeConnectedWith(faberAliceConnectionRecord)
    expect(bobConnectionRecord).toBeConnectedWith(faberBobConnectionRecord)

    await aliceAgent.wallet.delete()
    await aliceAgent.shutdown()
    await bobAgent.wallet.delete()
    await bobAgent.shutdown()
    await faberAgent.wallet.delete()
    await faberAgent.shutdown()
  })
})
