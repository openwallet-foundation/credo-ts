/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { AskarWalletPostgresStorageConfig } from '../src/wallet'
import type { ConnectionRecord } from '@aries-framework/core'

import { Agent, HandshakeProtocol } from '@aries-framework/core'
import { Subject } from 'rxjs'

import { describeRunInNodeVersion } from '../../../tests/runInVersion'
import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { waitForBasicMessage } from '../../core/tests/helpers'

import { getPostgresAgentOptions } from './helpers'

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

// FIXME: Re-include in tests when Askar NodeJS wrapper performance is improved
describeRunInNodeVersion([18], 'Askar Postgres agents', () => {
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
