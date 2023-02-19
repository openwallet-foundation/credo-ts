/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { ConnectionRecord } from '../../core/src/modules/connections'
import type { IndySdkPostgresStorageConfig } from '../../node/src'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../../core/src/agent/Agent'
import { HandshakeProtocol } from '../../core/src/modules/connections'
import { waitForBasicMessage, getPostgresAgentOptions } from '../../core/tests/helpers'
import { loadIndySdkPostgresPlugin, IndySdkPostgresWalletScheme } from '../../node/src'

import { getIndySdkModules } from './setupIndySdkModule'

const alicePostgresAgentOptions = getPostgresAgentOptions(
  'AgentsAlice',
  {
    endpoints: ['rxjs:alice'],
  },
  getIndySdkModules()
)

const bobPostgresAgentOptions = getPostgresAgentOptions(
  'AgentsBob',
  {
    endpoints: ['rxjs:bob'],
  },
  getIndySdkModules()
)

describe('postgres agents', () => {
  let aliceAgent: Agent
  let bobAgent: Agent
  let aliceConnection: ConnectionRecord

  afterAll(async () => {
    await bobAgent.shutdown()
    await bobAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('make a connection between postgres agents', async () => {
    const aliceMessages = new Subject<SubjectMessage>()
    const bobMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:alice': aliceMessages,
      'rxjs:bob': bobMessages,
    }

    const storageConfig: IndySdkPostgresStorageConfig = {
      type: 'postgres_storage',
      config: {
        url: 'localhost:5432',
        wallet_scheme: IndySdkPostgresWalletScheme.DatabasePerWallet,
      },
      credentials: {
        account: 'postgres',
        password: 'postgres',
        admin_account: 'postgres',
        admin_password: 'postgres',
      },
    }

    // loading the postgres wallet plugin
    loadIndySdkPostgresPlugin(storageConfig.config, storageConfig.credentials)

    aliceAgent = new Agent(alicePostgresAgentOptions)
    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()

    bobAgent = new Agent(bobPostgresAgentOptions)
    bobAgent.registerInboundTransport(new SubjectInboundTransport(bobMessages))
    bobAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await bobAgent.initialize()

    const aliceBobOutOfBandRecord = await aliceAgent.oob.createInvitation({
      handshakeProtocols: [HandshakeProtocol.Connections],
    })

    const { connectionRecord: bobConnectionAtBobAlice } = await bobAgent.oob.receiveInvitation(
      aliceBobOutOfBandRecord.outOfBandInvitation
    )
    await bobAgent.connections.returnWhenIsConnected(bobConnectionAtBobAlice!.id)

    const [aliceConnectionAtAliceBob] = await aliceAgent.connections.findAllByOutOfBandId(aliceBobOutOfBandRecord.id)
    aliceConnection = await aliceAgent.connections.returnWhenIsConnected(aliceConnectionAtAliceBob!.id)
  })

  test('send a message to connection', async () => {
    const message = 'hello, world'
    await aliceAgent.basicMessages.sendMessage(aliceConnection.id, message)

    const basicMessage = await waitForBasicMessage(bobAgent, {
      content: message,
    })

    expect(basicMessage.content).toBe(message)
  })

  test('can shutdown and re-initialize the same postgres agent', async () => {
    expect(aliceAgent.isInitialized).toBe(true)
    await aliceAgent.shutdown()
    expect(aliceAgent.isInitialized).toBe(false)
    await aliceAgent.initialize()
    expect(aliceAgent.isInitialized).toBe(true)
  })
})
