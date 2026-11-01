import type { DidCommConnectionRecord } from '../../didcomm/src'

import { DidCommBasicMessageEventTypes, DidCommHandshakeProtocol } from '../../didcomm/src'
import { Agent } from '../src/agent/Agent'

import { type EventReplaySubject, setupEventReplaySubjects } from './events'
import { getAgentOptions, waitForBasicMessageSubject } from './helpers'
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
  let aliceConnection: DidCommConnectionRecord
  let bobConnection: DidCommConnectionRecord
  let bobReplay: EventReplaySubject

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
    ;[bobReplay] = setupEventReplaySubjects([bobAgent], [DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged])

    const aliceBobOutOfBandRecord = await aliceAgent.didcomm.oob.createInvitation({
      handshakeProtocols: [DidCommHandshakeProtocol.DidExchange],
    })

    const { connectionRecord: bobConnectionAtBobAlice } = await bobAgent.didcomm.oob.receiveInvitation(
      aliceBobOutOfBandRecord.outOfBandInvitation,
      { label: 'alice' }
    )
    bobConnection = await bobAgent.didcomm.connections.returnWhenIsConnected(bobConnectionAtBobAlice?.id)

    const [aliceConnectionAtAliceBob] = await aliceAgent.didcomm.connections.findAllByOutOfBandId(
      aliceBobOutOfBandRecord.id
    )
    aliceConnection = await aliceAgent.didcomm.connections.returnWhenIsConnected(aliceConnectionAtAliceBob?.id)

    expect(aliceConnection).toBeConnectedWith(bobConnection)
    expect(bobConnection).toBeConnectedWith(aliceConnection)
  })

  test('send a message to connection', async () => {
    const message = 'hello, world'
    const { threadId } = await aliceAgent.didcomm.basicMessages.sendMessage(aliceConnection.id, message)

    const basicMessage = await waitForBasicMessageSubject(bobReplay, {
      threadId,
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
