/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { IndySdkSovDidCreateOptions } from '@aries-framework/indy-sdk'

import { getLegacyAnonCredsModules } from '../../../../../anoncreds/tests/legacyAnonCredsSetup'
import { setupSubjectTransports } from '../../../../tests'
import {
  getAgentOptions,
  importExistingIndyDidFromPrivateKey,
  publicDidSeed,
  waitForConnectionRecord,
} from '../../../../tests/helpers'
import { TestLogger } from '../../../../tests/logger'
import { Agent } from '../../../agent/Agent'
import { LogLevel } from '../../../logger'
import { TypedArrayEncoder } from '../../../utils'
import { sleep } from '../../../utils/sleep'
import { DidExchangeState, HandshakeProtocol } from '../../connections'

const faberAgentOptions = getAgentOptions(
  'Faber Agent OOB Implicit',
  {
    endpoints: ['rxjs:faber'],
    logger: new TestLogger(LogLevel.debug),
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
  let unqualifiedSubmitterDid: string

  beforeAll(async () => {
    faberAgent = new Agent(faberAgentOptions)
    aliceAgent = new Agent(aliceAgentOptions)

    setupSubjectTransports([faberAgent, aliceAgent])
    await faberAgent.initialize()
    await aliceAgent.initialize()

    unqualifiedSubmitterDid = await importExistingIndyDidFromPrivateKey(
      faberAgent,
      TypedArrayEncoder.fromString(publicDidSeed)
    )
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
    const publicDid = await createPublicDid(faberAgent, unqualifiedSubmitterDid, 'rxjs:faber')
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
    const publicDid = await createPublicDid(faberAgent, unqualifiedSubmitterDid, 'rxjs:faber')
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
    const publicDid = await createPublicDid(faberAgent, unqualifiedSubmitterDid, 'rxjs:faber')
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
    expect(await aliceAgent.connections.findByInvitationDid(publicDid!)).toHaveLength(2)
    expect((await aliceAgent.connections.findByInvitationDid(publicDid!)).map((item) => item.id)).toEqual(
      expect.arrayContaining([aliceFaberConnection.id, aliceFaberNewConnection.id])
    )
  })
})

async function createPublicDid(agent: Agent, unqualifiedSubmitterDid: string, endpoint: string) {
  const createResult = await agent.dids.create<IndySdkSovDidCreateOptions>({
    method: 'sov',
    options: {
      submitterVerificationMethod: `did:sov:${unqualifiedSubmitterDid}#key-1`,
      alias: 'Alias',
      endpoints: {
        endpoint,
        types: ['DIDComm', 'did-communication', 'endpoint'],
      },
    },
  })

  await sleep(1000)

  return createResult.didState.did
}
