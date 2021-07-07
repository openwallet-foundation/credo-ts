import type { ConnectionRecord } from '../src/modules/connections'

import { Subject } from 'rxjs'

import { Agent } from '../src/agent/Agent'

import {
  SubjectInboundTransporter,
  SubjectOutboundTransporter,
  waitForBasicMessage,
  getBaseConfig,
  closeAndDeleteWallet,
} from './helpers'

const aliceConfig = getBaseConfig('Agents Alice')
const bobConfig = getBaseConfig('Agents Bob')

describe('agents', () => {
  let aliceAgent: Agent
  let bobAgent: Agent
  let aliceConnection: ConnectionRecord
  let bobConnection: ConnectionRecord

  afterAll(async () => {
    await closeAndDeleteWallet(aliceAgent)
    await closeAndDeleteWallet(bobAgent)
  })

  test('make a connection between agents', async () => {
    const aliceMessages = new Subject()
    const bobMessages = new Subject()

    aliceAgent = new Agent(aliceConfig.config, aliceConfig.agentDependencies)
    aliceAgent.setInboundTransporter(new SubjectInboundTransporter(aliceMessages, bobMessages))
    aliceAgent.setOutboundTransporter(new SubjectOutboundTransporter(bobMessages))
    await aliceAgent.initialize()

    bobAgent = new Agent(bobConfig.config, bobConfig.agentDependencies)
    bobAgent.setInboundTransporter(new SubjectInboundTransporter(bobMessages, aliceMessages))
    bobAgent.setOutboundTransporter(new SubjectOutboundTransporter(aliceMessages))
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
