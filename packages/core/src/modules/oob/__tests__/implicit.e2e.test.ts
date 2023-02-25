/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { SubjectMessage } from '../../../../../../tests/transport/SubjectInboundTransport'
import type { IndySdkSovDidCreateOptions } from '@aries-framework/indy-sdk'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../tests/transport/SubjectOutboundTransport'
import { getLegacyAnonCredsModules } from '../../../../../anoncreds/tests/legacyAnonCredsSetup'
import { getAgentOptions, waitForConnectionRecord } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { DidExchangeState, HandshakeProtocol } from '../../connections'

const faberAgentOptions = getAgentOptions(
  'Faber Agent OOB Implicit',
  {
    endpoints: ['rxjs:faber'],
  },
  getLegacyAnonCredsModules()
)
const aliceAgentOptions = getAgentOptions(
  'Alice Agent OOB Implicit',
  {
    endpoints: ['rxjs:alice'],
  },
  getLegacyAnonCredsModules()
)

describe('out of band implicit', () => {
  let faberAgent: Agent
  let aliceAgent: Agent

  beforeAll(async () => {
    const faberMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()
    const subjectMap = {
      'rxjs:faber': faberMessages,
      'rxjs:alice': aliceMessages,
    }

    faberAgent = new Agent(faberAgentOptions)
    faberAgent.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()

    aliceAgent = new Agent(aliceAgentOptions)
    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  afterEach(async () => {
    const credentials = await aliceAgent.credentials.getAll()
    for (const credential of credentials) {
      await aliceAgent.credentials.deleteById(credential.id)
    }

    const connections = await faberAgent.connections.getAll()
    for (const connection of connections) {
      await faberAgent.connections.deleteById(connection.id)
    }

    jest.resetAllMocks()
  })

  test(`make a connection with ${HandshakeProtocol.DidExchange} based on implicit OOB invitation`, async () => {
    const publicDid = await createPublicDid(faberAgent, 'rxjs:faber')
    expect(publicDid).toBeDefined()

    let { connectionRecord: aliceFaberConnection } = await aliceAgent.oob.receiveImplicitInvitation({
      did: publicDid!,
      alias: 'Faber public',
      label: 'Alice',
    })

    aliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection!.id)
    expect(aliceFaberConnection.state).toBe(DidExchangeState.Completed)

    // Wait for a connection event in faber agent
    let faberAliceConnection = await waitForConnectionRecord(faberAgent, {})
    faberAliceConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceConnection!.id)
    expect(faberAliceConnection.state).toBe(DidExchangeState.Completed)

    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    expect(faberAliceConnection.theirLabel).toBe('Alice')
    expect(aliceFaberConnection.alias).toBe('Faber public')
    expect(aliceFaberConnection.invitationDid).toBe(publicDid)

    // It is possible for an agent to check if it has already a connection to a certain public entity
    expect((await aliceAgent.connections.findByInvitationDid(publicDid!)).map((item) => item.id)).toEqual([
      aliceFaberConnection.id,
    ])
  })

  test(`make a connection with ${HandshakeProtocol.Connections} based on implicit OOB invitation`, async () => {
    const publicDid = await createPublicDid(faberAgent, 'rxjs:faber')
    expect(publicDid).toBeDefined()

    let { connectionRecord: aliceFaberConnection } = await aliceAgent.oob.receiveImplicitInvitation({
      did: publicDid!,
      alias: 'Faber public',
      label: 'Alice',
      handshakeProtocols: [HandshakeProtocol.Connections],
    })

    aliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection!.id)
    expect(aliceFaberConnection.state).toBe(DidExchangeState.Completed)

    // Wait for a connection event in faber agent
    let faberAliceConnection = await waitForConnectionRecord(faberAgent, {})
    faberAliceConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceConnection!.id)
    expect(faberAliceConnection.state).toBe(DidExchangeState.Completed)

    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    expect(faberAliceConnection.theirLabel).toBe('Alice')
    expect(aliceFaberConnection.alias).toBe('Faber public')
    expect(aliceFaberConnection.invitationDid).toBe(publicDid)

    // It is possible for an agent to check if it has already a connection to a certain public entity
    expect((await aliceAgent.connections.findByInvitationDid(publicDid!)).map((item) => item.id)).toEqual([
      aliceFaberConnection.id,
    ])
  })

  test(`receive an implicit invitation using an unresolvable did`, async () => {
    await expect(
      aliceAgent.oob.receiveImplicitInvitation({
        did: 'did:sov:ZSEqSci581BDZCFPa29ScB',
        alias: 'Faber public',
        label: 'Alice',
        handshakeProtocols: [HandshakeProtocol.DidExchange],
      })
    ).rejects.toThrowError(/Unable to resolve did/)
  })

  test(`create two connections using the same implicit invitation`, async () => {
    const publicDid = await createPublicDid(faberAgent, 'rxjs:faber')
    expect(publicDid).toBeDefined()

    let { connectionRecord: aliceFaberConnection } = await aliceAgent.oob.receiveImplicitInvitation({
      did: publicDid!,
      alias: 'Faber public',
      label: 'Alice',
      handshakeProtocols: [HandshakeProtocol.Connections],
    })

    aliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection!.id)
    expect(aliceFaberConnection.state).toBe(DidExchangeState.Completed)

    // Wait for a connection event in faber agent
    let faberAliceConnection = await waitForConnectionRecord(faberAgent, {})
    faberAliceConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceConnection!.id)
    expect(faberAliceConnection.state).toBe(DidExchangeState.Completed)

    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    expect(faberAliceConnection.theirLabel).toBe('Alice')
    expect(aliceFaberConnection.alias).toBe('Faber public')
    expect(aliceFaberConnection.invitationDid).toBe(publicDid)

    // Repeat implicit invitation procedure
    let { connectionRecord: aliceFaberNewConnection } = await aliceAgent.oob.receiveImplicitInvitation({
      did: publicDid!,
      alias: 'Faber public New',
      label: 'Alice New',
      handshakeProtocols: [HandshakeProtocol.Connections],
    })

    aliceFaberNewConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberNewConnection!.id)
    expect(aliceFaberNewConnection.state).toBe(DidExchangeState.Completed)

    // Wait for a connection event in faber agent
    let faberAliceNewConnection = await waitForConnectionRecord(faberAgent, {})
    faberAliceNewConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceNewConnection!.id)
    expect(faberAliceNewConnection.state).toBe(DidExchangeState.Completed)

    expect(aliceFaberNewConnection).toBeConnectedWith(faberAliceNewConnection)
    expect(faberAliceNewConnection).toBeConnectedWith(aliceFaberNewConnection)
    expect(faberAliceNewConnection.theirLabel).toBe('Alice New')
    expect(aliceFaberNewConnection.alias).toBe('Faber public New')
    expect(aliceFaberNewConnection.invitationDid).toBe(publicDid)

    // Both connections will be associated to the same invitation did
    expect((await aliceAgent.connections.findByInvitationDid(publicDid!)).map((item) => item.id)).toEqual([
      aliceFaberConnection.id,
      aliceFaberNewConnection.id,
    ])
  })
})

async function createPublicDid(agent: Agent, endpoint: string) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain, @typescript-eslint/no-non-null-assertion
  const did = await agent.dids.create<IndySdkSovDidCreateOptions>({
    method: 'sov',
    options: {
      submitterDid: 'did:sov:TL1EaPFCZ8Si5aUrqScBDt',
      alias: 'Alias',
      endpoints: {
        endpoint,
        types: ['DIDComm', 'did-communication', 'endpoint'],
      },
    },
  })

  return did.didState.did
}
