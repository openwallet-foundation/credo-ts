import type { ConnectionRecord } from '../../didcomm/src'

import { HandshakeProtocol } from '../../didcomm/src'
import { Agent } from '../src/agent/Agent'

import { getAgentOptions, waitForBasicMessage } from './helpers'
import { setupSubjectTransports } from './transport'

const aliceAgentOptions = getAgentOptions(
  'Agents Alice',
  {
    endpoints: ['rxjs:alice'],
  },
  undefined,
  undefined,
  { requireDidcomm: true }
)
const bobAgentOptions = getAgentOptions(
  'Agents Bob',
  {
    endpoints: ['rxjs:bob'],
  },
  undefined,
  undefined,
  { requireDidcomm: true }
)

describe('agents', () => {
  let aliceAgent: Agent
  let bobAgent: Agent
  let aliceConnection: ConnectionRecord
  let bobConnection: ConnectionRecord

  afterAll(async () => {
    await bobAgent.shutdown()
    await aliceAgent.shutdown()
  })

  test('make a connection between agents', async () => {
    aliceAgent = new Agent(aliceAgentOptions)
    bobAgent = new Agent(bobAgentOptions)

    setupSubjectTransports([aliceAgent, bobAgent])

    await aliceAgent.initialize()
    await bobAgent.initialize()

    const aliceBobOutOfBandRecord = await aliceAgent.modules.oob.createInvitation({
      handshakeProtocols: [HandshakeProtocol.Connections],
    })

    const { connectionRecord: bobConnectionAtBobAlice } = await bobAgent.modules.oob.receiveInvitation(
      aliceBobOutOfBandRecord.outOfBandInvitation,
      { label: 'alice' }
    )
    bobConnection = await bobAgent.modules.connections.returnWhenIsConnected(bobConnectionAtBobAlice?.id)

    const [aliceConnectionAtAliceBob] = await aliceAgent.modules.connections.findAllByOutOfBandId(
      aliceBobOutOfBandRecord.id
    )
    aliceConnection = await aliceAgent.modules.connections.returnWhenIsConnected(aliceConnectionAtAliceBob?.id)

    expect(aliceConnection).toBeConnectedWith(bobConnection)
    expect(bobConnection).toBeConnectedWith(aliceConnection)
  })

  test('send a message to connection', async () => {
    const message = 'hello, world'
    await aliceAgent.modules.basicMessages.sendMessage(aliceConnection.id, message)

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
