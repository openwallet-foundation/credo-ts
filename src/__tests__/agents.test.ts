import type { ConnectionRecord } from '../modules/connections'

import { Subject } from 'rxjs'

import { Agent } from '../agent/Agent'

import { SubjectInboundTransporter, SubjectOutboundTransporter, waitForBasicMessage, getBaseConfig } from './helpers'

const aliceConfig = getBaseConfig('Agents Alice')
const bobConfig = getBaseConfig('Agents Bob')

describe('agents', () => {
  let aliceAgent: Agent
  let bobAgent: Agent
  let aliceConnection: ConnectionRecord
  let bobConnection: ConnectionRecord

  afterAll(async () => {
    await aliceAgent.closeAndDeleteWallet()
    await bobAgent.closeAndDeleteWallet()
  })

  test('make a connection between agents and send a message over the connection', async () => {
    const aliceMessages = new Subject()
    const bobMessages = new Subject()

    aliceAgent = new Agent(aliceConfig)
    aliceAgent.setInboundTransporter(new SubjectInboundTransporter(aliceMessages, bobMessages))
    aliceAgent.setOutboundTransporter(new SubjectOutboundTransporter(bobMessages))
    await aliceAgent.init()

    bobAgent = new Agent(bobConfig)
    bobAgent.setInboundTransporter(new SubjectInboundTransporter(bobMessages, aliceMessages))
    bobAgent.setOutboundTransporter(new SubjectOutboundTransporter(aliceMessages))
    await bobAgent.init()

    const aliceConnectionAtAliceBob = await aliceAgent.connections.createConnection()
    const bobConnectionAtBobAlice = await bobAgent.connections.receiveInvitation(aliceConnectionAtAliceBob.invitation)

    aliceConnection = await aliceAgent.connections.returnWhenIsConnected(aliceConnectionAtAliceBob.connectionRecord.id)
    bobConnection = await bobAgent.connections.returnWhenIsConnected(bobConnectionAtBobAlice.id)

    expect(aliceConnection).toBeConnectedWith(bobConnection)
    expect(bobConnection).toBeConnectedWith(aliceConnection)

    const message = 'hello, world'
    await aliceAgent.basicMessages.sendMessage(aliceConnection, message)

    const basicMessage = await waitForBasicMessage(bobAgent, {
      content: message,
    })

    expect(basicMessage.content).toBe(message)
  })
})
