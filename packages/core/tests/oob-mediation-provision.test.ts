import type { DidCommOutOfBandInvitation } from '../../didcomm/src/modules/oob/messages'

import { DidCommDidExchangeState, DidCommHandshakeProtocol } from '../../didcomm/src/modules/connections'
import {
  DidCommMediationRecipientModule,
  DidCommMediationState,
  DidCommMediatorModule,
  DidCommMediatorPickupStrategy,
} from '../../didcomm/src/modules/routing'
import { Agent } from '../src/agent/Agent'

import { getAgentOptions, waitForBasicMessage } from './helpers'
import { setupSubjectTransports } from './transport'

const faberAgentOptions = getAgentOptions(
  'OOB mediation provision - Faber Agent',
  {
    endpoints: ['rxjs:faber'],
  },
  undefined,
  undefined,
  { requireDidcomm: true }
)
const aliceAgentOptions = getAgentOptions(
  'OOB mediation provision - Alice Recipient Agent',
  {
    endpoints: ['rxjs:alice'],
    mediationRecipient: {
      mediatorPickupStrategy: MediatorPickupStrategy.PickUpV1,
    },
  },
  {},
  {
    mediationRecipient: new DidCommMediationRecipientModule({
      mediatorPickupStrategy: DidCommMediatorPickupStrategy.PickUpV1,
    }),
  },
  { requireDidcomm: true }
)
const mediatorAgentOptions = getAgentOptions(
  'OOB mediation provision - Mediator Agent',
  {
    endpoints: ['rxjs:mediator'],
    mediator: { autoAcceptMediationRequests: true },
  },
  {},
  { mediator: new DidCommMediatorModule({ autoAcceptMediationRequests: true }) },
  { requireDidcomm: true }
)

describe('out of band with mediation set up with provision method', () => {
  const makeConnectionConfig = {
    goal: 'To make a connection',
    goalCode: 'p2p-messaging',
    label: 'Faber College',
    handshake: true,
    multiUseInvitation: false,
  }

  let faberAgent: Agent<(typeof faberAgentOptions)['modules']>
  let aliceAgent: Agent<(typeof aliceAgentOptions)['modules']>
  let mediatorAgent: Agent<(typeof mediatorAgentOptions)['modules']>

  let mediatorOutOfBandInvitation: DidCommOutOfBandInvitation

  beforeAll(async () => {
    mediatorAgent = new Agent(mediatorAgentOptions)
    aliceAgent = new Agent(aliceAgentOptions)
    faberAgent = new Agent(faberAgentOptions)

    setupSubjectTransports([mediatorAgent, aliceAgent, faberAgent])

    await mediatorAgent.initialize()
    await aliceAgent.initialize()
    await faberAgent.initialize()

    const mediationOutOfBandRecord = await mediatorAgent.didcomm.oob.createInvitation(makeConnectionConfig)
    mediatorOutOfBandInvitation = mediationOutOfBandRecord.outOfBandInvitation

    let { connectionRecord } = await aliceAgent.didcomm.oob.receiveInvitation(mediatorOutOfBandInvitation, {
      label: 'alice',
    })
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    connectionRecord = await aliceAgent.didcomm.connections.returnWhenIsConnected(connectionRecord?.id!)
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    await aliceAgent.didcomm.mediationRecipient.provision(connectionRecord!)
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await aliceAgent.shutdown()
    await mediatorAgent.shutdown()
  })

  test(`make a connection with ${DidCommHandshakeProtocol.DidExchange} on OOB invitation encoded in URL`, async () => {
    // Check if mediation between Alice and Mediator has been set
    const defaultMediator = await aliceAgent.didcomm.mediationRecipient.findDefaultMediator()
    expect(defaultMediator).not.toBeNull()
    expect(defaultMediator?.state).toBe(DidCommMediationState.Granted)

    // Make a connection between Alice and Faber
    const outOfBandRecord = await faberAgent.didcomm.oob.createInvitation(makeConnectionConfig)
    const { outOfBandInvitation } = outOfBandRecord
    const urlMessage = outOfBandInvitation.toUrl({ domain: 'http://example.com' })

    let { connectionRecord: aliceFaberConnection } = await aliceAgent.didcomm.oob.receiveInvitationFromUrl(urlMessage, {
      label: 'alice',
    })

    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    aliceFaberConnection = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceFaberConnection?.id!)
    expect(aliceFaberConnection.state).toBe(DidCommDidExchangeState.Completed)

    let [faberAliceConnection] = await faberAgent.didcomm.connections.findAllByOutOfBandId(outOfBandRecord.id)
    faberAliceConnection = await faberAgent.didcomm.connections.returnWhenIsConnected(faberAliceConnection?.id)
    expect(faberAliceConnection.state).toBe(DidCommDidExchangeState.Completed)

    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)

    await aliceAgent.didcomm.basicMessages.sendMessage(aliceFaberConnection.id, 'hello')
    const basicMessage = await waitForBasicMessage(faberAgent, {})

    expect(basicMessage.content).toBe('hello')

    // Test if we can call provision for the same out-of-band record, respectively connection
    const reusedOutOfBandRecord = await aliceAgent.didcomm.oob.findByReceivedInvitationId(
      mediatorOutOfBandInvitation.id
    )
    const [reusedAliceMediatorConnection] = reusedOutOfBandRecord
      ? await aliceAgent.didcomm.connections.findAllByOutOfBandId(reusedOutOfBandRecord.id)
      : []
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    await aliceAgent.didcomm.mediationRecipient.provision(reusedAliceMediatorConnection!)
    const mediators = await aliceAgent.didcomm.mediationRecipient.getMediators()
    expect(mediators).toHaveLength(1)
  })
})
