import { Subject } from 'rxjs'
import { Agent } from '..'
import {
  toBeConnectedWith,
  SubjectInboundTransporter,
  SubjectOutboundTransporter,
  waitForBasicMessage,
} from './helpers'
import { InitConfig } from '../types'
import indy from 'indy-sdk'
import { ConnectionRecord } from '../modules/connections'
import testLogger from './logger'

expect.extend({ toBeConnectedWith })

const aliceConfig: InitConfig = {
  label: 'Alice',
  walletConfig: { id: 'alice' },
  walletCredentials: { key: '00000000000000000000000000000Test01' },
  autoAcceptConnections: true,
  logger: testLogger,
  indy,
}

const bobConfig: InitConfig = {
  label: 'Bob',
  walletConfig: { id: 'bob' },
  walletCredentials: { key: '00000000000000000000000000000Test02' },
  autoAcceptConnections: true,
  logger: testLogger,
  indy,
}

describe('agents', () => {
  let aliceAgent: Agent
  let bobAgent: Agent
  let aliceConnection: ConnectionRecord
  let bobConnection: ConnectionRecord

  afterAll(async () => {
    await aliceAgent.closeAndDeleteWallet()
    await bobAgent.closeAndDeleteWallet()
  })

  test('make a connection between agents', async () => {
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
