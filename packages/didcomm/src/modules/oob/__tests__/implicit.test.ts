import { type DidDocumentKey, Kms } from '@credo-ts/core'
import { Agent } from '../../../../../core/src/agent/Agent'
import {
  DidCommV1Service,
  DidDocumentBuilder,
  DidDocumentService,
  DidsModule,
  NewDidCommV2Service,
  NewDidCommV2ServiceEndpoint,
  getEd25519VerificationKey2018,
} from '../../../../../core/src/modules/dids'
import { setupSubjectTransports } from '../../../../../core/tests'
import { getAgentOptions, waitForConnectionRecord } from '../../../../../core/tests/helpers'
import { DidCommDidExchangeState, DidCommHandshakeProtocol } from '../../connections'
import { InMemoryDidRegistry } from '../../connections/__tests__/InMemoryDidRegistry'

const inMemoryDidsRegistry = new InMemoryDidRegistry()

const faberAgentOptions = getAgentOptions(
  'Faber Agent OOB Implicit',
  {
    endpoints: ['rxjs:faber'],
  },
  {},
  {
    dids: new DidsModule({
      resolvers: [inMemoryDidsRegistry],
      registrars: [inMemoryDidsRegistry],
    }),
  },
  { requireDidcomm: true }
)
const aliceAgentOptions = getAgentOptions(
  'Alice Agent OOB Implicit',
  {
    endpoints: ['rxjs:alice'],
  },
  {},
  {
    dids: new DidsModule({
      resolvers: [inMemoryDidsRegistry],
      registrars: [inMemoryDidsRegistry],
    }),
  },
  { requireDidcomm: true }
)

describe('out of band implicit', () => {
  let faberAgent: Agent<typeof faberAgentOptions.modules>
  let aliceAgent: Agent<typeof aliceAgentOptions.modules>

  beforeAll(async () => {
    faberAgent = new Agent(faberAgentOptions)
    aliceAgent = new Agent(aliceAgentOptions)

    setupSubjectTransports([faberAgent, aliceAgent])
    await faberAgent.initialize()
    await aliceAgent.initialize()
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await aliceAgent.shutdown()
  })

  afterEach(async () => {
    const connections = await faberAgent.modules.connections.getAll()
    for (const connection of connections) {
      await faberAgent.modules.connections.deleteById(connection.id)
    }

    jest.resetAllMocks()
  })

  test(`make a connection with ${DidCommHandshakeProtocol.DidExchange} based on implicit OOB invitation`, async () => {
    const inMemoryDid = await createInMemoryDid(faberAgent, 'rxjs:faber')

    let { connectionRecord: aliceFaberConnection } = await aliceAgent.modules.oob.receiveImplicitInvitation({
      did: inMemoryDid,
      alias: 'Faber public',
      label: 'Custom Alice',
      handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
    })

    // Wait for a connection event in faber agent and accept the request
    let faberAliceConnection = await waitForConnectionRecord(faberAgent, { state: DidCommDidExchangeState.RequestReceived })
    await faberAgent.modules.connections.acceptRequest(faberAliceConnection.id)
    faberAliceConnection = await faberAgent.modules.connections.returnWhenIsConnected(faberAliceConnection?.id)
    expect(faberAliceConnection.state).toBe(DidCommDidExchangeState.Completed)

    // Alice should now be connected
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    aliceFaberConnection = await aliceAgent.modules.connections.returnWhenIsConnected(aliceFaberConnection?.id!)
    expect(aliceFaberConnection.state).toBe(DidCommDidExchangeState.Completed)

    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    expect(faberAliceConnection.theirLabel).toBe('Custom Alice')
    expect(aliceFaberConnection.theirLabel).toBe('Faber public')
    expect(aliceFaberConnection.invitationDid).toBe(inMemoryDid)

    // It is possible for an agent to check if it has already a connection to a certain public entity
    expect(await aliceAgent.modules.connections.findByInvitationDid(inMemoryDid)).toEqual([aliceFaberConnection])
  })

  test(`make a connection with ${DidCommHandshakeProtocol.DidExchange} based on implicit OOB invitation pointing to specific service`, async () => {
    const inMemoryDid = await createInMemoryDid(faberAgent, 'rxjs:faber')
    const inMemoryDidDocument = await faberAgent.dids.resolveDidDocument(inMemoryDid)
    const serviceUrl = inMemoryDidDocument.service?.[1].id

    let { connectionRecord: aliceFaberConnection } = await aliceAgent.modules.oob.receiveImplicitInvitation({
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      did: serviceUrl!,
      alias: 'Faber public',
      handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
    })

    // Wait for a connection event in faber agent and accept the request
    let faberAliceConnection = await waitForConnectionRecord(faberAgent, { state: DidCommDidExchangeState.RequestReceived })
    await faberAgent.modules.connections.acceptRequest(faberAliceConnection.id)
    faberAliceConnection = await faberAgent.modules.connections.returnWhenIsConnected(faberAliceConnection?.id)
    expect(faberAliceConnection.state).toBe(DidCommDidExchangeState.Completed)

    // Alice should now be connected
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    aliceFaberConnection = await aliceAgent.modules.connections.returnWhenIsConnected(aliceFaberConnection?.id!)
    expect(aliceFaberConnection.state).toBe(DidCommDidExchangeState.Completed)

    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    expect(faberAliceConnection.theirLabel).toBe(aliceAgent.config.label)
    expect(aliceFaberConnection.theirLabel).toBe('Faber public')
    expect(aliceFaberConnection.invitationDid).toBe(serviceUrl)

    // It is possible for an agent to check if it has already a connection to a certain public entity
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    expect(await aliceAgent.modules.connections.findByInvitationDid(serviceUrl!)).toEqual([aliceFaberConnection])
  })

  test(`make a connection with ${DidCommHandshakeProtocol.Connections} based on implicit OOB invitation`, async () => {
    const inMemoryDid = await createInMemoryDid(faberAgent, 'rxjs:faber')

    let { connectionRecord: aliceFaberConnection } = await aliceAgent.modules.oob.receiveImplicitInvitation({
      did: inMemoryDid,
      alias: 'Faber public',
      handshakeProtocols: [DidCommHandshakeProtocol.Connections],
    })

    // Wait for a connection event in faber agent and accept the request
    let faberAliceConnection = await waitForConnectionRecord(faberAgent, { state: DidCommDidExchangeState.RequestReceived })
    await faberAgent.modules.connections.acceptRequest(faberAliceConnection.id)
    faberAliceConnection = await faberAgent.modules.connections.returnWhenIsConnected(faberAliceConnection?.id)
    expect(faberAliceConnection.state).toBe(DidCommDidExchangeState.Completed)

    // Alice should now be connected
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    aliceFaberConnection = await aliceAgent.modules.connections.returnWhenIsConnected(aliceFaberConnection?.id!)
    expect(aliceFaberConnection.state).toBe(DidCommDidExchangeState.Completed)

    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    expect(faberAliceConnection.theirLabel).toBe(aliceAgent.config.label)
    expect(aliceFaberConnection.theirLabel).toBe('Faber public')
    expect(aliceFaberConnection.invitationDid).toBe(inMemoryDid)

    // It is possible for an agent to check if it has already a connection to a certain public entity
    expect(await aliceAgent.modules.connections.findByInvitationDid(inMemoryDid)).toEqual([aliceFaberConnection])
  })

  test('receive an implicit invitation using an unresolvable did', async () => {
    await expect(
      aliceAgent.modules.oob.receiveImplicitInvitation({
        did: 'did:sov:ZSEqSci581BDZCFPa29ScB',
        alias: 'Faber public',
        handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
      })
    ).rejects.toThrow(/Unable to resolve did/)
  })

  test('create two connections using the same implicit invitation', async () => {
    const inMemoryDid = await createInMemoryDid(faberAgent, 'rxjs:faber')

    let { connectionRecord: aliceFaberConnection } = await aliceAgent.modules.oob.receiveImplicitInvitation({
      did: inMemoryDid,
      alias: 'Faber public',
      handshakeProtocols: [DidCommHandshakeProtocol.Connections],
    })

    // Wait for a connection event in faber agent and accept the request
    let faberAliceConnection = await waitForConnectionRecord(faberAgent, { state: DidCommDidExchangeState.RequestReceived })
    await faberAgent.modules.connections.acceptRequest(faberAliceConnection.id)
    faberAliceConnection = await faberAgent.modules.connections.returnWhenIsConnected(faberAliceConnection?.id)
    expect(faberAliceConnection.state).toBe(DidCommDidExchangeState.Completed)

    // Alice should now be connected
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    aliceFaberConnection = await aliceAgent.modules.connections.returnWhenIsConnected(aliceFaberConnection?.id!)
    expect(aliceFaberConnection.state).toBe(DidCommDidExchangeState.Completed)

    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    expect(faberAliceConnection.theirLabel).toBe(aliceAgent.config.label)
    expect(aliceFaberConnection.theirLabel).toBe('Faber public')
    expect(aliceFaberConnection.invitationDid).toBe(inMemoryDid)

    // Repeat implicit invitation procedure
    let { connectionRecord: aliceFaberNewConnection } = await aliceAgent.modules.oob.receiveImplicitInvitation({
      did: inMemoryDid,
      alias: 'Faber public New',
      label: 'Alice New',
      handshakeProtocols: [DidCommHandshakeProtocol.Connections],
    })

    // Wait for a connection event in faber agent
    let faberAliceNewConnection = await waitForConnectionRecord(faberAgent, { state: DidCommDidExchangeState.RequestReceived })
    await faberAgent.modules.connections.acceptRequest(faberAliceNewConnection.id)
    faberAliceNewConnection = await faberAgent.modules.connections.returnWhenIsConnected(faberAliceNewConnection?.id)
    expect(faberAliceNewConnection.state).toBe(DidCommDidExchangeState.Completed)

    // Alice should now be connected
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    aliceFaberNewConnection = await aliceAgent.modules.connections.returnWhenIsConnected(aliceFaberNewConnection?.id!)
    expect(aliceFaberNewConnection.state).toBe(DidCommDidExchangeState.Completed)

    expect(aliceFaberNewConnection).toBeConnectedWith(faberAliceNewConnection)
    expect(faberAliceNewConnection).toBeConnectedWith(aliceFaberNewConnection)
    expect(faberAliceNewConnection.theirLabel).toBe('Alice New')
    expect(aliceFaberNewConnection.theirLabel).toBe('Faber public New')
    expect(aliceFaberNewConnection.invitationDid).toBe(inMemoryDid)

    // Both connections will be associated to the same invitation did
    const connectionsFromFaberPublicDid = await aliceAgent.modules.connections.findByInvitationDid(inMemoryDid)
    expect(connectionsFromFaberPublicDid).toHaveLength(2)
    expect(connectionsFromFaberPublicDid).toEqual(
      expect.arrayContaining([aliceFaberConnection, aliceFaberNewConnection])
    )
  })
})

async function createInMemoryDid(agent: Agent, endpoint: string) {
  const ed25519Key = await agent.kms.createKey({
    type: {
      kty: 'OKP',
      crv: 'Ed25519',
    },
  })
  const publicJwk = Kms.PublicJwk.fromPublicJwk(ed25519Key.publicJwk)

  const did = `did:inmemory:${publicJwk.fingerprint}`
  const builder = new DidDocumentBuilder(did)
  const ed25519VerificationMethod = getEd25519VerificationKey2018({
    publicJwk,
    id: `${did}#${publicJwk.fingerprint}`,
    controller: did,
  })

  builder.addService(
    new DidDocumentService({
      id: `${did}#endpoint`,
      serviceEndpoint: endpoint,
      type: 'endpoint',
    })
  )
  builder.addService(
    new DidCommV1Service({
      id: `${did}#did-communication`,
      priority: 0,
      recipientKeys: [ed25519VerificationMethod.id],
      routingKeys: [],
      serviceEndpoint: endpoint,
      accept: ['didcomm/aip2;env=rfc19'],
    })
  )

  builder.addService(
    new NewDidCommV2Service({
      id: `${did}#didcomm-messaging-1`,
      serviceEndpoint: new NewDidCommV2ServiceEndpoint({
        accept: ['didcomm/v2'],
        routingKeys: [],
        uri: endpoint,
      }),
    })
  )

  builder.addVerificationMethod(ed25519VerificationMethod)
  builder.addAuthentication(ed25519VerificationMethod.id)
  builder.addAssertionMethod(ed25519VerificationMethod.id)

  // Create the did:inmemory did
  const {
    didState: { state },
  } = await agent.dids.create({
    did,
    didDocument: builder.build(),
    options: {
      keys: [
        {
          didDocumentRelativeKeyId: `#${publicJwk.fingerprint}`,
          kmsKeyId: ed25519Key.keyId,
        } satisfies DidDocumentKey,
      ],
    },
  })

  if (state !== 'finished') {
    throw new Error('Error creating DID')
  }

  return did
}
