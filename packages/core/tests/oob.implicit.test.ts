/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { CreateOfferOptions } from '../src/modules/credentials'
import type { IndyCredentialFormat } from '../src/modules/credentials/formats/indy/IndyCredentialFormat'
import type { SovDidCreateOptions } from '@aries-framework/core'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../src/agent/Agent'
import { DidExchangeState, HandshakeProtocol } from '../src/modules/connections'
import { OutOfBandRole } from '../src/modules/oob/domain/OutOfBandRole'
import { OutOfBandState } from '../src/modules/oob/domain/OutOfBandState'
import { sleep } from '../src/utils/sleep'

import { getAgentOptions } from './helpers'

import { ConsoleLogger, LogLevel } from '@aries-framework/core'

const faberAgentOptions = getAgentOptions('Faber Agent OOB', {
  endpoints: ['rxjs:faber'],
  logger: new ConsoleLogger(LogLevel.debug),
})
const aliceAgentOptions = getAgentOptions('Alice Agent OOB', {
  endpoints: ['rxjs:alice'],
  logger: new ConsoleLogger(LogLevel.debug),
})

describe('out of band implicit', () => {
  const makeConnectionConfig = {
    goal: 'To make a connection',
    goalCode: 'p2p-messaging',
    label: 'Faber College',
    alias: `Faber's connection with Alice`,
  }

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

  describe('receiveInvitation', () => {
    test.skip('receive implicit OOB invitation', async () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain, @typescript-eslint/no-non-null-assertion
      const submitterDid = `did:sov:${faberAgent.publicDid?.did!}`

      const did = await faberAgent.dids.create<SovDidCreateOptions>({
        method: 'sov',
        options: {
          submitterDid,
          alias: 'Alias',
          endpoints: {
            endpoint: 'rxjs:faber',
            types: ['DIDComm', 'did-communication', 'endpoint'],
          },
        },
      })

      const { outOfBandRecord: receivedOutOfBandRecord, connectionRecord } =
        await aliceAgent.oob.receiveImplicitInvitation(did.didState.did!, {
          autoAcceptInvitation: false,
          autoAcceptConnection: false,
        })

      expect(connectionRecord).not.toBeDefined()
      expect(receivedOutOfBandRecord.role).toBe(OutOfBandRole.Receiver)
      expect(receivedOutOfBandRecord.state).toBe(OutOfBandState.Initial)
      //expect(receivedOutOfBandRecord.outOfBandInvitation).toEqual(outOfBandInvitation)
    })

    test(`make a connection with ${HandshakeProtocol.Connections} based on implicit OOB invitation`, async () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain, @typescript-eslint/no-non-null-assertion
      const submitterDid = `did:sov:${faberAgent.publicDid?.did!}`

      const did = await faberAgent.dids.create<SovDidCreateOptions>({
        method: 'sov',
        options: {
          submitterDid,
          alias: 'Alias',
          endpoints: {
            endpoint: 'rxjs:faber',
            types: ['DIDComm', 'did-communication', 'endpoint'],
          },
        },
      })

      let { outOfBandRecord, connectionRecord: aliceFaberConnection } = await aliceAgent.oob.receiveImplicitInvitation(
        did.didState.did!,
        {}
      )

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
      expect(faberAliceConnection.alias).toBe(makeConnectionConfig.alias)
    })
  })
})
