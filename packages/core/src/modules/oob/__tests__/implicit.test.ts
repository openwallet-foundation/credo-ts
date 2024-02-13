/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { PeerDidCreateOptions } from '../../dids'

import { getAnonCredsIndyModules } from '../../../../../anoncreds/tests/legacyAnonCredsSetup'
import { setupSubjectTransports } from '../../../../tests'
import { getInMemoryAgentOptions, waitForConnectionRecord } from '../../../../tests/helpers'
import { Agent } from '../../../agent/Agent'
import { KeyType } from '../../../crypto'
import { DidExchangeState, HandshakeProtocol } from '../../connections'
import {
  DidCommV1Service,
  DidCommV2Service,
  DidDocumentService,
  PeerDidNumAlgo,
  DidDocumentBuilder,
  getEd25519VerificationKey2018,
} from '../../dids'

const faberAgentOptions = getInMemoryAgentOptions(
  'Faber Agent OOB Implicit',
  {
    endpoints: ['rxjs:faber'],
  },
  getAnonCredsIndyModules()
)
const aliceAgentOptions = getInMemoryAgentOptions(
  'Alice Agent OOB Implicit',
  {
    endpoints: ['rxjs:alice'],
  },
  getAnonCredsIndyModules()
)

describe('out of band implicit', () => {
  let faberAgent: Agent
  let aliceAgent: Agent

  beforeAll(async () => {
    faberAgent = new Agent(faberAgentOptions)
    aliceAgent = new Agent(aliceAgentOptions)

    setupSubjectTransports([faberAgent, aliceAgent])
    await faberAgent.initialize()
    await aliceAgent.initialize()
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  afterEach(async () => {
    const connections = await faberAgent.connections.getAll()
    for (const connection of connections) {
      await faberAgent.connections.deleteById(connection.id)
    }

    jest.resetAllMocks()
  })

  test(`make a connection with ${HandshakeProtocol.DidExchange} based on implicit OOB invitation`, async () => {
    const peerDid = await createPeerDid(faberAgent, 'rxjs:faber')

    let { connectionRecord: aliceFaberConnection } = await aliceAgent.oob.receiveImplicitInvitation({
      did: peerDid,
      alias: 'Faber public',
      label: 'Alice',
      handshakeProtocols: [HandshakeProtocol.DidExchange],
    })

    // Wait for a connection event in faber agent and accept the request
    let faberAliceConnection = await waitForConnectionRecord(faberAgent, { state: DidExchangeState.RequestReceived })
    await faberAgent.connections.acceptRequest(faberAliceConnection.id)
    faberAliceConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceConnection!.id)
    expect(faberAliceConnection.state).toBe(DidExchangeState.Completed)

    // Alice should now be connected
    aliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection!.id)
    expect(aliceFaberConnection.state).toBe(DidExchangeState.Completed)

    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    expect(faberAliceConnection.theirLabel).toBe('Alice')
    expect(aliceFaberConnection.alias).toBe('Faber public')
    expect(aliceFaberConnection.invitationDid).toBe(peerDid)

    // It is possible for an agent to check if it has already a connection to a certain public entity
    expect(await aliceAgent.connections.findByInvitationDid(peerDid)).toEqual([aliceFaberConnection])
  })

  test(`make a connection with ${HandshakeProtocol.DidExchange} based on implicit OOB invitation pointing to specific service`, async () => {
    const peerDid = await createPeerDid(faberAgent, 'rxjs:faber')
    const peerDidDocument = await faberAgent.dids.resolveDidDocument(peerDid)
    const serviceUrl = peerDidDocument.service![1].id

    let { connectionRecord: aliceFaberConnection } = await aliceAgent.oob.receiveImplicitInvitation({
      did: serviceUrl,
      alias: 'Faber public',
      label: 'Alice',
      handshakeProtocols: [HandshakeProtocol.DidExchange],
    })

    // Wait for a connection event in faber agent and accept the request
    let faberAliceConnection = await waitForConnectionRecord(faberAgent, { state: DidExchangeState.RequestReceived })
    await faberAgent.connections.acceptRequest(faberAliceConnection.id)
    faberAliceConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceConnection!.id)
    expect(faberAliceConnection.state).toBe(DidExchangeState.Completed)

    // Alice should now be connected
    aliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection!.id)
    expect(aliceFaberConnection.state).toBe(DidExchangeState.Completed)

    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    expect(faberAliceConnection.theirLabel).toBe('Alice')
    expect(aliceFaberConnection.alias).toBe('Faber public')
    expect(aliceFaberConnection.invitationDid).toBe(serviceUrl)

    // It is possible for an agent to check if it has already a connection to a certain public entity
    expect(await aliceAgent.connections.findByInvitationDid(serviceUrl)).toEqual([aliceFaberConnection])
  })

  test(`make a connection with ${HandshakeProtocol.Connections} based on implicit OOB invitation`, async () => {
    const peerDid = await createPeerDid(faberAgent, 'rxjs:faber')

    let { connectionRecord: aliceFaberConnection } = await aliceAgent.oob.receiveImplicitInvitation({
      did: peerDid,
      alias: 'Faber public',
      label: 'Alice',
      handshakeProtocols: [HandshakeProtocol.Connections],
    })

    // Wait for a connection event in faber agent and accept the request
    let faberAliceConnection = await waitForConnectionRecord(faberAgent, { state: DidExchangeState.RequestReceived })
    await faberAgent.connections.acceptRequest(faberAliceConnection.id)
    faberAliceConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceConnection!.id)
    expect(faberAliceConnection.state).toBe(DidExchangeState.Completed)

    // Alice should now be connected
    aliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection!.id)
    expect(aliceFaberConnection.state).toBe(DidExchangeState.Completed)

    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    expect(faberAliceConnection.theirLabel).toBe('Alice')
    expect(aliceFaberConnection.alias).toBe('Faber public')
    expect(aliceFaberConnection.invitationDid).toBe(peerDid)

    // It is possible for an agent to check if it has already a connection to a certain public entity
    expect(await aliceAgent.connections.findByInvitationDid(peerDid)).toEqual([aliceFaberConnection])
  })

  test(`receive an implicit invitation using an unresolvable did`, async () => {
    await expect(
      aliceAgent.oob.receiveImplicitInvitation({
        did: 'did:sov:ZSEqSci581BDZCFPa29ScB',
        alias: 'Faber public',
        label: 'Alice',
        handshakeProtocols: [HandshakeProtocol.DidExchange],
      })
    ).rejects.toThrow(/Unable to resolve did/)
  })

  test(`create two connections using the same implicit invitation`, async () => {
    const peerDid = await createPeerDid(faberAgent, 'rxjs:faber')

    let { connectionRecord: aliceFaberConnection } = await aliceAgent.oob.receiveImplicitInvitation({
      did: peerDid,
      alias: 'Faber public',
      label: 'Alice',
      handshakeProtocols: [HandshakeProtocol.Connections],
    })

    // Wait for a connection event in faber agent and accept the request
    let faberAliceConnection = await waitForConnectionRecord(faberAgent, { state: DidExchangeState.RequestReceived })
    await faberAgent.connections.acceptRequest(faberAliceConnection.id)
    faberAliceConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceConnection!.id)
    expect(faberAliceConnection.state).toBe(DidExchangeState.Completed)

    // Alice should now be connected
    aliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection!.id)
    expect(aliceFaberConnection.state).toBe(DidExchangeState.Completed)

    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    expect(faberAliceConnection.theirLabel).toBe('Alice')
    expect(aliceFaberConnection.alias).toBe('Faber public')
    expect(aliceFaberConnection.invitationDid).toBe(peerDid)

    // Repeat implicit invitation procedure
    let { connectionRecord: aliceFaberNewConnection } = await aliceAgent.oob.receiveImplicitInvitation({
      did: peerDid,
      alias: 'Faber public New',
      label: 'Alice New',
      handshakeProtocols: [HandshakeProtocol.Connections],
    })

    // Wait for a connection event in faber agent
    let faberAliceNewConnection = await waitForConnectionRecord(faberAgent, { state: DidExchangeState.RequestReceived })
    await faberAgent.connections.acceptRequest(faberAliceNewConnection.id)
    faberAliceNewConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceNewConnection!.id)
    expect(faberAliceNewConnection.state).toBe(DidExchangeState.Completed)

    // Alice should now be connected
    aliceFaberNewConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberNewConnection!.id)
    expect(aliceFaberNewConnection.state).toBe(DidExchangeState.Completed)

    expect(aliceFaberNewConnection).toBeConnectedWith(faberAliceNewConnection)
    expect(faberAliceNewConnection).toBeConnectedWith(aliceFaberNewConnection)
    expect(faberAliceNewConnection.theirLabel).toBe('Alice New')
    expect(aliceFaberNewConnection.alias).toBe('Faber public New')
    expect(aliceFaberNewConnection.invitationDid).toBe(peerDid)

    // Both connections will be associated to the same invitation did
    const connectionsFromFaberPublicDid = await aliceAgent.connections.findByInvitationDid(peerDid)
    expect(connectionsFromFaberPublicDid).toHaveLength(2)
    expect(connectionsFromFaberPublicDid).toEqual(
      expect.arrayContaining([aliceFaberConnection, aliceFaberNewConnection])
    )
  })
})

async function createPeerDid(agent: Agent, endpoint: string) {
  const builder = new DidDocumentBuilder('')

  const ed25519Key = await agent.wallet.createKey({
    keyType: KeyType.Ed25519,
  })
  const ed25519VerificationMethod = getEd25519VerificationKey2018({
    key: ed25519Key,
    id: `#${ed25519Key.fingerprint.slice(1)}`,
    controller: '#',
  })

  builder.addService(
    new DidDocumentService({
      id: `#endpoint`,
      serviceEndpoint: endpoint,
      type: 'endpoint',
    })
  )
  builder.addService(
    new DidCommV1Service({
      id: `#did-communication`,
      priority: 0,
      recipientKeys: [ed25519VerificationMethod.id],
      routingKeys: [],
      serviceEndpoint: endpoint,
      accept: ['didcomm/aip2;env=rfc19'],
    })
  )

  builder.addService(
    new DidCommV2Service({
      accept: ['didcomm/v2'],
      id: `#didcomm-1`,
      routingKeys: [],
      serviceEndpoint: endpoint,
    })
  )

  builder.addVerificationMethod(ed25519VerificationMethod)
  builder.addAuthentication(ed25519VerificationMethod.id)
  builder.addAssertionMethod(ed25519VerificationMethod.id)

  const createResult = await agent.dids.create<PeerDidCreateOptions>({
    method: 'peer',
    didDocument: builder.build(),
    options: {
      numAlgo: PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc,
    },
  })

  return createResult.didState.did as string
}
