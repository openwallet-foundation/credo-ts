/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { IndySdkSovDidCreateOptions } from '@aries-framework/indy-sdk'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { getLegacyAnonCredsModules } from '../../anoncreds/tests/legacyAnonCredsSetup'
import { Agent } from '../src/agent/Agent'
import { DidExchangeState, HandshakeProtocol } from '../src/modules/connections'
import { sleep } from '../src/utils/sleep'

import { getAgentOptions } from './helpers'

const faberAgentOptions = getAgentOptions(
  'Faber Agent OOB',
  {
    endpoints: ['rxjs:faber'],
  },
  getLegacyAnonCredsModules()
)
const aliceAgentOptions = getAgentOptions(
  'Alice Agent OOB',
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

  describe('receiveimplicitInvitation', () => {
    test(`make a connection with ${HandshakeProtocol.DidExchange} based on implicit OOB invitation`, async () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain, @typescript-eslint/no-non-null-assertion
      const did = await faberAgent.dids.create<IndySdkSovDidCreateOptions>({
        method: 'sov',
        options: {
          submitterDid: 'did:sov:TL1EaPFCZ8Si5aUrqScBDt',
          alias: 'Alias',
          endpoints: {
            endpoint: 'rxjs:faber',
            types: ['DIDComm', 'did-communication', 'endpoint'],
          },
        },
      })

      const publicDid = did.didState.did
      expect(publicDid).toBeDefined()

      let { connectionRecord: aliceFaberConnection } = await aliceAgent.oob.receiveImplicitInvitation({
        did: publicDid!,
        alias: 'Faber public',
        label: 'Alice',
      })

      aliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection!.id)
      expect(aliceFaberConnection.state).toBe(DidExchangeState.Completed)

      await sleep(1000)
      // TODO: Wait for a connection event
      expect((await faberAgent.connections.getAll()).length).toEqual(1)
      //const [faberAliceConnection] = await faberAgent.connections.findAllByOutOfBandId(outOfBandRecord!.id)
      let [faberAliceConnection] = await faberAgent.connections.getAll()
      faberAliceConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceConnection!.id)
      expect(faberAliceConnection.state).toBe(DidExchangeState.Completed)

      expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
      expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
      expect(faberAliceConnection.theirLabel).toBe('Alice')
      expect(aliceFaberConnection.alias).toBe('Faber public')
      expect(aliceFaberConnection.invitationDid).toBe(publicDid)
    })
  })

  test(`make a connection with ${HandshakeProtocol.Connections} based on implicit OOB invitation`, async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain, @typescript-eslint/no-non-null-assertion
    const did = await faberAgent.dids.create<IndySdkSovDidCreateOptions>({
      method: 'sov',
      options: {
        submitterDid: 'did:sov:TL1EaPFCZ8Si5aUrqScBDt',
        alias: 'Alias',
        endpoints: {
          endpoint: 'rxjs:faber',
          types: ['DIDComm', 'did-communication', 'endpoint'],
        },
      },
    })

    const publicDid = did.didState.did
    expect(publicDid).toBeDefined()

    let { connectionRecord: aliceFaberConnection } = await aliceAgent.oob.receiveImplicitInvitation({
      did: publicDid!,
      alias: 'Faber public',
      label: 'Alice',
      handshakeProtocols: [HandshakeProtocol.Connections],
    })

    aliceFaberConnection = await aliceAgent.connections.returnWhenIsConnected(aliceFaberConnection!.id)
    expect(aliceFaberConnection.state).toBe(DidExchangeState.Completed)

    await sleep(1000)
    // TODO: Wait for a connection event
    expect((await faberAgent.connections.getAll()).length).toEqual(1)
    //const [faberAliceConnection] = await faberAgent.connections.findAllByOutOfBandId(outOfBandRecord!.id)
    let [faberAliceConnection] = await faberAgent.connections.getAll()
    faberAliceConnection = await faberAgent.connections.returnWhenIsConnected(faberAliceConnection!.id)
    expect(faberAliceConnection.state).toBe(DidExchangeState.Completed)

    expect(aliceFaberConnection).toBeConnectedWith(faberAliceConnection)
    expect(faberAliceConnection).toBeConnectedWith(aliceFaberConnection)
    expect(faberAliceConnection.theirLabel).toBe('Alice')
    expect(aliceFaberConnection.alias).toBe('Faber public')
    expect(aliceFaberConnection.invitationDid).toBe(publicDid)
  })
})
