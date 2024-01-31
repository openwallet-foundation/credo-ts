/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { ConnectionRecord } from '../src/modules/connections'

import { Agent } from '../src/agent/Agent'
import { HandshakeProtocol } from '../src/modules/connections'

import { waitForBasicMessage, getInMemoryAgentOptions } from './helpers'
import { setupSubjectTransports } from './transport'

const aliceAgentOptions = getInMemoryAgentOptions('Agents Alice', {
  endpoints: ['rxjs:alice'],
})
const bobAgentOptions = getInMemoryAgentOptions('Agents Bob', {
  endpoints: ['rxjs:bob'],
})

describe('agents', () => {
  let aliceAgent: Agent
  let bobAgent: Agent
  let aliceConnection: ConnectionRecord
  let bobConnection: ConnectionRecord

  afterAll(async () => {
    await bobAgent.shutdown()
    await bobAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('make a connection between agents', async () => {
    aliceAgent = new Agent(aliceAgentOptions)
    bobAgent = new Agent(bobAgentOptions)

    setupSubjectTransports([aliceAgent, bobAgent])

    await aliceAgent.initialize()
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

    expect(aliceConnection).toBeConnectedWith(bobConnection)
    expect(bobConnection).toBeConnectedWith(aliceConnection)
  })

  test('send a message to connection', async () => {
    const message = 'hello, world'
    await aliceAgent.basicMessages.sendMessage(aliceConnection.id, message)

    const basicMessage = await waitForBasicMessage(bobAgent, {
      content: message,
    })

    expect(basicMessage.content).toBe(message)
  })

  test('can shutdown and re-initialize the same agent', async () => {
    expect(aliceAgent.isInitialized).toBe(true)
    await aliceAgent.shutdown()
    expect(aliceAgent.isInitialized).toBe(false)
    await aliceAgent.initialize()
    expect(aliceAgent.isInitialized).toBe(true)
  })
})
