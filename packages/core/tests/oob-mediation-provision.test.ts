/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { OutOfBandInvitation } from '../src/modules/oob/messages'

import { getIndySdkModules } from '../../indy-sdk/tests/setupIndySdkModule'
import { Agent } from '../src/agent/Agent'
import { DidExchangeState, HandshakeProtocol } from '../src/modules/connections'
import { MediationState, MediatorPickupStrategy } from '../src/modules/routing'

import { getAgentOptions, waitForBasicMessage } from './helpers'
import { setupSubjectTransports } from './transport'

const faberAgentOptions = getAgentOptions(
  'OOB mediation provision - Faber Agent',
  {
    endpoints: ['rxjs:faber'],
  },
  getIndySdkModules()
)
const aliceAgentOptions = getAgentOptions(
  'OOB mediation provision - Alice Recipient Agent',
  {
    endpoints: ['rxjs:alice'],
    mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
  },
  getIndySdkModules()
)
const mediatorAgentOptions = getAgentOptions(
  'OOB mediation provision - Mediator Agent',
  {
    endpoints: ['rxjs:mediator'],
    autoAcceptMediationRequests: true,
  },
  getIndySdkModules()
)

describe('out of band with mediation set up with provision method', () => {
  const makeConnectionConfig = {
    goal: 'To make a connection',
    goalCode: 'p2p-messaging',
    label: 'Faber College',
    handshake: true,
    multiUseInvitation: false,
  }

  let faberAgent: Agent
  let aliceAgent: Agent
  let mediatorAgent: Agent

  let mediatorOutOfBandInvitation: OutOfBandInvitation

  beforeAll(async () => {
    mediatorAgent = new Agent(mediatorAgentOptions)
    aliceAgent = new Agent(aliceAgentOptions)
    faberAgent = new Agent(faberAgentOptions)

    setupSubjectTransports([mediatorAgent, aliceAgent, faberAgent])

    await mediatorAgent.initialize()
    await aliceAgent.initialize()
    await faberAgent.initialize()

    const mediationOutOfBandRecord = await mediatorAgent.oob.createInvitation(makeConnectionConfig)
    mediatorOutOfBandInvitation = mediationOutOfBandRecord.outOfBandInvitation

    let { connectionRecord } = await aliceAgent.oob.receiveInvitation(mediatorOutOfBandInvitation)
    connectionRecord = await aliceAgent.connections.returnWhenIsConnected(connectionRecord!.id)
    await aliceAgent.mediationRecipient.provision(connectionRecord!)
    await aliceAgent.mediationRecipient.initialize()
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
    await mediatorAgent.shutdown()
    await mediatorAgent.wallet.delete()
  })

  test(`make a connection with ${HandshakeProtocol.DidExchange} on OOB invitation encoded in URL`, async () => {
    // Check if mediation between Alice and Mediator has been set
    const defaultMediator = await aliceAgent.mediationRecipient.findDefaultMediator()
    expect(defaultMediator).not.toBeNull()
    expect(defaultMediator?.state).toBe(MediationState.Granted)

    // Make a connection between Alice and Faber
    const outOfBandRecord = await faberAgent.oob.createInvitation(makeConnectionConfig)
    const { outOfBandInvitation } = outOfBandRecord
    const urlMessage = outOfBandInvitation.toUrl({ domain: 'http://example.com' })

    let { connectionRecord: aliceFaberConnection } = await aliceAgent.oob.receiveInvitationFromUrl(urlMessage)

    aliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection!.id)
    expect(aliceFaberConnection.state).toBe(DidExchangeState.Completed)

    let [faberAliceConnection] = await faberAgent.connections.findAllByOutOfBandId(outOfBandRecord.id)
    faberAliceConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceConnection!.id)
    expect(faberAliceConnection.state).toBe(DidExchangeState.Completed)

    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)

    await aliceAgent.basicMessages.sendMessage(aliceFaberConnection.id, 'hello')
    const basicMessage = await waitForBasicMessage(faberAgent, {})

    expect(basicMessage.content).toBe('hello')

    // Test if we can call provision for the same out-of-band record, respectively connection
    const reusedOutOfBandRecord = await aliceAgent.oob.findByReceivedInvitationId(mediatorOutOfBandInvitation.id)
    const [reusedAliceMediatorConnection] = reusedOutOfBandRecord
      ? await aliceAgent.connections.findAllByOutOfBandId(reusedOutOfBandRecord.id)
      : []
    await aliceAgent.mediationRecipient.provision(reusedAliceMediatorConnection!)
    const mediators = await aliceAgent.mediationRecipient.getMediators()
    expect(mediators).toHaveLength(1)
  })
})
