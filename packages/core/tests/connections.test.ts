import { TypedArrayEncoder } from '@credo-ts/core'

import { filter, map, timeout } from 'rxjs'
import type { DidCommKeylistUpdate, DidCommMessageProcessedEvent } from '../../didcomm/src'
import {
  DidCommDidExchangeState,
  DidCommEventTypes,
  DidCommHandshakeProtocol,
  DidCommKeylistUpdateAction,
  DidCommKeylistUpdateMessage,
} from '../../didcomm/src'
import { DidCommOutOfBandState } from '../../didcomm/src/modules/oob/domain/DidCommOutOfBandState'
import { Agent } from '../src/agent/Agent'
import { didKeyToVerkey } from '../src/modules/dids/helpers'
import { Ed25519PublicJwk, PublicJwk } from '../src/modules/kms'
import { firstValueWithStackTrace, getAgentOptions, waitForTrustPingResponseReceivedEvent } from './helpers'
import { setupSubjectTransports } from './transport'

const faberAgent = new Agent(
  getAgentOptions(
    'Faber Agent Connections',
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
    'Alice Agent Connections',
    {
      endpoints: ['rxjs:alice'],
    },
    undefined,
    undefined,
    { requireDidcomm: true }
  )
)
const acmeAgent = new Agent(
  getAgentOptions(
    'Acme Agent Connections',
    {
      endpoints: ['rxjs:acme'],
    },
    undefined,
    undefined,
    { requireDidcomm: true }
  )
)
const mediatorAgent = new Agent(
  getAgentOptions(
    'Mediator Agent Connections',
    {
      endpoints: ['rxjs:mediator'],
      mediator: {
        autoAcceptMediationRequests: true,
      },
    },
    {},
    {},
    { requireDidcomm: true }
  )
)

describe('connections', () => {
  beforeEach(async () => {
    setupSubjectTransports([faberAgent, aliceAgent, acmeAgent, mediatorAgent])

    await faberAgent.initialize()
    await aliceAgent.initialize()
    await acmeAgent.initialize()
    await mediatorAgent.initialize()
  })

  afterEach(async () => {
    await faberAgent.shutdown()
    await aliceAgent.shutdown()
    await acmeAgent.shutdown()
    await mediatorAgent.shutdown()
  })

  it('one agent should be able to send and receive a ping', async () => {
    const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({
      handshakeProtocols: [DidCommHandshakeProtocol.Connections],
      multiUseInvitation: true,
    })

    const invitation = faberOutOfBandRecord.outOfBandInvitation
    const invitationUrl = invitation.toUrl({ domain: 'https://example.com' })

    // Receive invitation with alice agent
    let { connectionRecord: aliceFaberConnection } = await aliceAgent.didcomm.oob.receiveInvitationFromUrl(
      invitationUrl,
      { label: 'alice' }
    )
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    aliceFaberConnection = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceFaberConnection?.id!)
    expect(aliceFaberConnection.state).toBe(DidCommDidExchangeState.Completed)

    const ping = await aliceAgent.didcomm.connections.sendPing(aliceFaberConnection.id, {})

    await waitForTrustPingResponseReceivedEvent(aliceAgent, { threadId: ping.threadId })
  })

  it('one should be able to make multiple connections using a multi use invite', async () => {
    const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({
      handshakeProtocols: [DidCommHandshakeProtocol.Connections],
      multiUseInvitation: true,
    })

    const invitation = faberOutOfBandRecord.outOfBandInvitation
    const invitationUrl = invitation.toUrl({ domain: 'https://example.com' })

    // Receive invitation first time with alice agent
    let { connectionRecord: aliceFaberConnection } = await aliceAgent.didcomm.oob.receiveInvitationFromUrl(
      invitationUrl,
      { label: 'alice' }
    )
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    aliceFaberConnection = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceFaberConnection?.id!)
    expect(aliceFaberConnection.state).toBe(DidCommDidExchangeState.Completed)

    // Receive invitation second time with acme agent
    let { connectionRecord: acmeFaberConnection } = await acmeAgent.didcomm.oob.receiveInvitationFromUrl(
      invitationUrl,
      {
        label: 'acme',
        reuseConnection: false,
      }
    )
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    acmeFaberConnection = await acmeAgent.didcomm.connections.returnWhenIsConnected(acmeFaberConnection?.id!)
    expect(acmeFaberConnection.state).toBe(DidCommDidExchangeState.Completed)

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    let faberAliceConnection = await faberAgent.didcomm.connections.getByThreadId(aliceFaberConnection.threadId!)
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    let faberAcmeConnection = await faberAgent.didcomm.connections.getByThreadId(acmeFaberConnection.threadId!)

    faberAliceConnection = await faberAgent.didcomm.connections.returnWhenIsConnected(faberAliceConnection.id)
    faberAcmeConnection = await faberAgent.didcomm.connections.returnWhenIsConnected(faberAcmeConnection.id)

    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    expect(faberAcmeConnection).toBeConnectedWith(acmeFaberConnection)

    expect(faberAliceConnection.id).not.toBe(faberAcmeConnection.id)

    return expect(faberOutOfBandRecord.state).toBe(DidCommOutOfBandState.AwaitResponse)
  })

  it('tag connections with multiple types and query them', async () => {
    const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({
      handshakeProtocols: [DidCommHandshakeProtocol.Connections],
      multiUseInvitation: true,
    })

    const invitation = faberOutOfBandRecord.outOfBandInvitation
    const invitationUrl = invitation.toUrl({ domain: 'https://example.com' })

    // Receive invitation first time with alice agent
    let { connectionRecord: aliceFaberConnection } = await aliceAgent.didcomm.oob.receiveInvitationFromUrl(
      invitationUrl,
      { label: 'alice' }
    )
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    aliceFaberConnection = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceFaberConnection?.id!)
    expect(aliceFaberConnection.state).toBe(DidCommDidExchangeState.Completed)

    // Mark connection with three different types
    aliceFaberConnection = await aliceAgent.didcomm.connections.addConnectionType(
      aliceFaberConnection.id,
      'alice-faber-1'
    )
    aliceFaberConnection = await aliceAgent.didcomm.connections.addConnectionType(
      aliceFaberConnection.id,
      'alice-faber-2'
    )
    aliceFaberConnection = await aliceAgent.didcomm.connections.addConnectionType(
      aliceFaberConnection.id,
      'alice-faber-3'
    )

    // Now search for them
    let connectionsFound = await aliceAgent.didcomm.connections.findAllByConnectionTypes(['alice-faber-4'])
    expect(connectionsFound).toEqual([])
    connectionsFound = await aliceAgent.didcomm.connections.findAllByConnectionTypes(['alice-faber-1'])
    expect(connectionsFound.map((item) => item.id)).toMatchObject([aliceFaberConnection.id])
    connectionsFound = await aliceAgent.didcomm.connections.findAllByConnectionTypes(['alice-faber-2'])
    expect(connectionsFound.map((item) => item.id)).toMatchObject([aliceFaberConnection.id])
    connectionsFound = await aliceAgent.didcomm.connections.findAllByConnectionTypes(['alice-faber-3'])
    expect(connectionsFound.map((item) => item.id)).toMatchObject([aliceFaberConnection.id])
    connectionsFound = await aliceAgent.didcomm.connections.findAllByConnectionTypes(['alice-faber-1', 'alice-faber-3'])
    expect(connectionsFound.map((item) => item.id)).toMatchObject([aliceFaberConnection.id])
    connectionsFound = await aliceAgent.didcomm.connections.findAllByConnectionTypes([
      'alice-faber-1',
      'alice-faber-2',
      'alice-faber-3',
    ])
    expect(connectionsFound.map((item) => item.id)).toMatchObject([aliceFaberConnection.id])
    connectionsFound = await aliceAgent.didcomm.connections.findAllByConnectionTypes(['alice-faber-1', 'alice-faber-4'])
    expect(connectionsFound).toEqual([])
  })

  it.skip('should be able to make multiple connections using a multi use invite', async () => {
    const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({
      handshakeProtocols: [DidCommHandshakeProtocol.Connections],
      multiUseInvitation: true,
    })

    const invitation = faberOutOfBandRecord.outOfBandInvitation
    const invitationUrl = invitation.toUrl({ domain: 'https://example.com' })

    // Create first connection
    let { connectionRecord: aliceFaberConnection1 } = await aliceAgent.didcomm.oob.receiveInvitationFromUrl(
      invitationUrl,
      { label: 'alice' }
    )

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    aliceFaberConnection1 = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceFaberConnection1?.id!)
    expect(aliceFaberConnection1.state).toBe(DidCommDidExchangeState.Completed)

    // Create second connection
    let { connectionRecord: aliceFaberConnection2 } = await aliceAgent.didcomm.oob.receiveInvitationFromUrl(
      invitationUrl,
      {
        label: 'agent',
        reuseConnection: false,
      }
    )
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    aliceFaberConnection2 = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceFaberConnection2?.id!)
    expect(aliceFaberConnection2.state).toBe(DidCommDidExchangeState.Completed)

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    let faberAliceConnection1 = await faberAgent.didcomm.connections.getByThreadId(aliceFaberConnection1.threadId!)
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    let faberAliceConnection2 = await faberAgent.didcomm.connections.getByThreadId(aliceFaberConnection2.threadId!)

    faberAliceConnection1 = await faberAgent.didcomm.connections.returnWhenIsConnected(faberAliceConnection1.id)
    faberAliceConnection2 = await faberAgent.didcomm.connections.returnWhenIsConnected(faberAliceConnection2.id)

    expect(faberAliceConnection1).toBeConnectedWith(aliceFaberConnection1)
    expect(faberAliceConnection2).toBeConnectedWith(aliceFaberConnection2)

    expect(faberAliceConnection1.id).not.toBe(faberAliceConnection2.id)

    return expect(faberOutOfBandRecord.state).toBe(DidCommOutOfBandState.AwaitResponse)
  })

  it('agent using mediator should be able to make multiple connections using a multi use invite', async () => {
    // Make Faber use a mediator
    const { outOfBandInvitation: mediatorOutOfBandInvitation } = await mediatorAgent.didcomm.oob.createInvitation({})
    let { connectionRecord } = await faberAgent.didcomm.oob.receiveInvitation(mediatorOutOfBandInvitation, {
      label: 'faber',
    })
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    connectionRecord = await faberAgent.didcomm.connections.returnWhenIsConnected(connectionRecord?.id!)

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    const mediationRecord = await faberAgent.didcomm.mediationRecipient.provision(connectionRecord!)
    faberAgent.didcomm.mediationRecipient.initiateMessagePickup(mediationRecord)

    // Create observable for event
    const keyAddMessageObservable = mediatorAgent.events
      .observable<DidCommMessageProcessedEvent>(DidCommEventTypes.DidCommMessageProcessed)
      .pipe(
        filter((event) => event.payload.message.type === DidCommKeylistUpdateMessage.type.messageTypeUri),
        map((event) => event.payload.message as DidCommKeylistUpdateMessage),
        timeout(5000)
      )

    const keylistAddEvents: DidCommKeylistUpdate[] = []
    keyAddMessageObservable.subscribe((value) => {
      for (const update of value.updates) {
        keylistAddEvents.push({ action: update.action, recipientKey: didKeyToVerkey(update.recipientKey) })
      }
    })

    // Now create invitations that will be mediated
    const faberOutOfBandRecord = await faberAgent.didcomm.oob.createInvitation({
      handshakeProtocols: [DidCommHandshakeProtocol.Connections],
      multiUseInvitation: true,
    })

    const invitation = faberOutOfBandRecord.outOfBandInvitation
    const invitationUrl = invitation.toUrl({ domain: 'https://example.com' })

    // Receive invitation first time with alice agent
    let { connectionRecord: aliceFaberConnection } = await aliceAgent.didcomm.oob.receiveInvitationFromUrl(
      invitationUrl,
      { label: 'alice' }
    )
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    aliceFaberConnection = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceFaberConnection?.id!)
    expect(aliceFaberConnection.state).toBe(DidCommDidExchangeState.Completed)

    // Receive invitation second time with acme agent
    let { connectionRecord: acmeFaberConnection } = await acmeAgent.didcomm.oob.receiveInvitationFromUrl(
      invitationUrl,
      {
        label: 'acme',
        reuseConnection: false,
      }
    )
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    acmeFaberConnection = await acmeAgent.didcomm.connections.returnWhenIsConnected(acmeFaberConnection?.id!)
    expect(acmeFaberConnection.state).toBe(DidCommDidExchangeState.Completed)

    // biome-ignore lint/style/noNonNullAssertion: no explanation
    let faberAliceConnection = await faberAgent.didcomm.connections.getByThreadId(aliceFaberConnection.threadId!)
    // biome-ignore lint/style/noNonNullAssertion: no explanation
    let faberAcmeConnection = await faberAgent.didcomm.connections.getByThreadId(acmeFaberConnection.threadId!)

    faberAliceConnection = await faberAgent.didcomm.connections.returnWhenIsConnected(faberAliceConnection.id)
    faberAcmeConnection = await faberAgent.didcomm.connections.returnWhenIsConnected(faberAcmeConnection.id)

    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    expect(faberAcmeConnection).toBeConnectedWith(acmeFaberConnection)

    expect(faberAliceConnection.id).not.toBe(faberAcmeConnection.id)

    expect(faberOutOfBandRecord.state).toBe(DidCommOutOfBandState.AwaitResponse)

    // Mediator should have received all new keys (the one of the invitation + the ones generated on each connection)
    expect(keylistAddEvents.length).toEqual(3)

    expect(keylistAddEvents).toEqual(
      expect.arrayContaining([
        {
          action: DidCommKeylistUpdateAction.add,
          recipientKey: TypedArrayEncoder.toBase58(
            (
              PublicJwk.fromFingerprint(
                faberOutOfBandRecord.getTags().recipientKeyFingerprints[0]
              ) as PublicJwk<Ed25519PublicJwk>
            ).publicKey.publicKey
          ),
        },
        {
          action: DidCommKeylistUpdateAction.add,
          recipientKey: TypedArrayEncoder.toBase58(
            // biome-ignore lint/style/noNonNullAssertion: no explanation
            (await faberAgent.dids.resolveDidDocument(faberAliceConnection.did!)).recipientKeys[0].publicKey.publicKey
          ),
        },
        {
          action: DidCommKeylistUpdateAction.add,
          recipientKey: TypedArrayEncoder.toBase58(
            // biome-ignore lint/style/noNonNullAssertion: no explanation
            (await faberAgent.dids.resolveDidDocument(faberAcmeConnection.did!)).recipientKeys[0].publicKey.publicKey
          ),
        },
      ])
    )

    for (const connection of [faberAcmeConnection, faberAliceConnection]) {
      const keyRemoveMessagePromise = firstValueWithStackTrace(
        mediatorAgent.events.observable<DidCommMessageProcessedEvent>(DidCommEventTypes.DidCommMessageProcessed).pipe(
          filter((event) => event.payload.message.type === DidCommKeylistUpdateMessage.type.messageTypeUri),
          map((event) => event.payload.message as DidCommKeylistUpdateMessage),
          timeout(5000)
        )
      )

      await faberAgent.didcomm.connections.deleteById(connection.id)

      const keyRemoveMessage = await keyRemoveMessagePromise
      expect(keyRemoveMessage.updates.length).toEqual(1)

      expect(
        keyRemoveMessage.updates.map((update) => ({
          action: update.action,
          recipientKey: didKeyToVerkey(update.recipientKey),
        }))[0]
      ).toEqual({
        action: DidCommKeylistUpdateAction.remove,
        recipientKey: TypedArrayEncoder.toBase58(
          // biome-ignore lint/style/noNonNullAssertion: no explanation
          (await faberAgent.dids.resolveDidDocument(connection.did!)).recipientKeys[0].publicKey.publicKey
        ),
      })
    }
  })
})
