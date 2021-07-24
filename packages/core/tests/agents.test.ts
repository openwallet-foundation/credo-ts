import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { ConnectionRecord } from '../src/modules/connections'

import { Subject } from 'rxjs'

import { SubjectInboundTransporter } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransporter } from '../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../src/agent/Agent'

import { waitForBasicMessage, getBaseConfig } from './helpers'

const aliceConfig = getBaseConfig('Agents Alice', {
  endpoint: 'rxjs:alice',
})
const bobConfig = getBaseConfig('Agents Bob', {
  endpoint: 'rxjs:bob',
})

describe('agents', () => {
  let aliceAgent: Agent
  let bobAgent: Agent
  let aliceConnection: ConnectionRecord
  let bobConnection: ConnectionRecord

  afterAll(async () => {
    await bobAgent.shutdown({
      deleteWallet: true,
    })

    await aliceAgent.shutdown({
      deleteWallet: true,
    })
  })

  test('make a connection between agents', async () => {
    const aliceMessages = new Subject<SubjectMessage>()
    const bobMessages = new Subject<SubjectMessage>()

    const subjectMap = {
      'rxjs:alice': aliceMessages,
      'rxjs:bob': bobMessages,
    }

    aliceAgent = new Agent(aliceConfig.config, aliceConfig.agentDependencies)
    aliceAgent.setInboundTransporter(new SubjectInboundTransporter(aliceMessages))
    aliceAgent.registerOutboundTransporter(new SubjectOutboundTransporter(aliceMessages, subjectMap), 0)
    await aliceAgent.initialize()

    bobAgent = new Agent(bobConfig.config, bobConfig.agentDependencies)
    bobAgent.setInboundTransporter(new SubjectInboundTransporter(bobMessages))
    bobAgent.registerOutboundTransporter(new SubjectOutboundTransporter(bobMessages, subjectMap), 0)
    await bobAgent.initialize()

    const aliceConnectionAtAliceBob = await aliceAgent.connections.createConnection()
    const bobConnectionAtBobAlice = await bobAgent.connections.receiveInvitation(aliceConnectionAtAliceBob.invitation)

    aliceConnection = await aliceAgent.connections.returnWhenIsConnected(aliceConnectionAtAliceBob.connectionRecord.id)
    bobConnection = await bobAgent.connections.returnWhenIsConnected(bobConnectionAtBobAlice.id)

    expect(aliceConnection).toBeConnectedWith(bobConnection)
    expect(bobConnection).toBeConnectedWith(aliceConnection)
  })

  test('send a message to connection', async () => {
    const message = 'hello, world'
    await aliceAgent.basicMessages.sendMessage(aliceConnection, message)

    const basicMessage = await waitForBasicMessage(bobAgent, {
      content: message,
    })

    expect(basicMessage.content).toBe(message)
  })
})
