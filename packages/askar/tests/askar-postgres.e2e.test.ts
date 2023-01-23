/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { AskarWalletPostgresStorageConfig } from '../src/wallet'
import type { ConnectionRecord } from '@aries-framework/core'

import { DependencyManager, InjectionSymbols, Agent, HandshakeProtocol } from '@aries-framework/core'
import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { waitForBasicMessage } from '../../core/tests/helpers'
import { AskarStorageService } from '../src/storage'
import { AskarWallet } from '../src/wallet'

import { getPostgresAgentOptions } from './helpers'

// FIXME: Remove when Askar JS Wrapper performance issues are solved
jest.setTimeout(120000)

const storageConfig: AskarWalletPostgresStorageConfig = {
  type: 'postgres',
  config: {
    host: 'localhost:5432',
  },
  credentials: {
    account: 'postgres',
    password: 'postgres',
  },
}

const alicePostgresAgentOptions = getPostgresAgentOptions('AgentsAlice', storageConfig, {
  endpoints: ['rxjs:alice'],
})
const bobPostgresAgentOptions = getPostgresAgentOptions('AgentsBob', storageConfig, {
  endpoints: ['rxjs:bob'],
})

describe('Askar Postgres agents', () => {
  let aliceAgent: Agent
  let bobAgent: Agent
  let aliceConnection: ConnectionRecord
  let bobConnection: ConnectionRecord

  afterAll(async () => {
    if (bobAgent) {
      await bobAgent.shutdown()
      await bobAgent.wallet.delete()
    }

    if (aliceAgent) {
      await aliceAgent.shutdown()
      await aliceAgent.wallet.delete()
    }
  })

  test('make a connection between postgres agents', async () => {
    const aliceMessages = new Subject<SubjectMessage>()
    const bobMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:alice': aliceMessages,
      'rxjs:bob': bobMessages,
    }

    const aliceDependencyManager = new DependencyManager()
    aliceDependencyManager.registerContextScoped(InjectionSymbols.Wallet, AskarWallet)
    aliceDependencyManager.registerSingleton(InjectionSymbols.StorageService, AskarStorageService)
    aliceAgent = new Agent(alicePostgresAgentOptions, aliceDependencyManager)
    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()

    const bobDependencyManager = new DependencyManager()
    bobDependencyManager.registerContextScoped(InjectionSymbols.Wallet, AskarWallet)
    bobDependencyManager.registerSingleton(InjectionSymbols.StorageService, AskarStorageService)
    bobAgent = new Agent(bobPostgresAgentOptions, bobDependencyManager)
    bobAgent.registerInboundTransport(new SubjectInboundTransport(bobMessages))
    bobAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await bobAgent.initialize()

    const aliceBobOutOfBandRecord = await aliceAgent.oob.createInvitation({
      handshakeProtocols: [HandshakeProtocol.Connections],
    })

    const { connectionRecord: bobConnectionAtBobAlice } = await bobAgent.oob.receiveInvitation(
      aliceBobOutOfBandRecord.outOfBandInvitation
    )
    bobConnection = await bobAgent.connections.returnWhenIsConnected(bobConnectionAtBobAlice!.id)

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
