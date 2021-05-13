import { Agent, ConnectionRecord, InboundTransporter, OutboundTransporter } from '../../src'
import { OutboundPackage, InitConfig } from '../../src/types'
import { get, post } from '../http'
import { sleep, toBeConnectedWith, waitForBasicMessage, waitForMediationRecord } from '../../src/__tests__/helpers'
import indy from 'indy-sdk'
import logger from '../../src/__tests__/logger'
import { MediationState } from '../../src'
import { AgentConfig } from '../../src/agent/AgentConfig'
import { IndyWallet } from '../../src/wallet/IndyWallet'
import { Wallet } from '../../src/wallet/Wallet'

expect.extend({ toBeConnectedWith })

const aliceConfig: InitConfig = {
  label: 'e2e Alice',
  host: 'http://localhost',
  port: 3001,
  walletConfig: { id: 'e2e-alice' },
  walletCredentials: { key: '00000000000000000000000000000Test01' },
  autoAcceptConnections: true,
  indy,
  logger: logger,
}

const bobConfig: InitConfig = {
  label: 'e2e Bob',
  host: 'http://localhost',
  port: 3002,
  walletConfig: { id: 'e2e-bob' },
  walletCredentials: { key: '00000000000000000000000000000Test02' },
  autoAcceptConnections: true,
  indy,
  logger: logger,
}

const mediatorConfig: InitConfig = {
  label: 'e2e ned',
  host: 'http://localhost',
  port: 3003,
  walletConfig: { id: 'e2e-ned' },
  walletCredentials: { key: '00000000000000000000000000000Test03' },
  autoAcceptConnections: true,
  indy,
  logger: logger,
}

describe('with mediator', () => {
  let aliceAgent: Agent
  let bobAgent: Agent
  let mediator: Agent
  let aliceAtAliceBobId: string
  /*let aliceConfig: AgentConfig
  let aliceWallet: Wallet

  beforeAll(async () => {
    aliceConfig = new AgentConfig(aliceConfig)
    aliceWallet = new IndyWallet(aliceConfig)
    await aliceWallet.init()
  })
*/
  afterAll(async () => {
    ;(aliceAgent.inboundTransporter as PollingInboundTransporter).stop = true
    ;(bobAgent.inboundTransporter as PollingInboundTransporter).stop = true
    ;(mediator.inboundTransporter as PollingInboundTransporter).stop = true

    // Wait for messages to flush out
    await new Promise((r) => setTimeout(r, 1000))

    await aliceAgent.closeAndDeleteWallet()
    await bobAgent.closeAndDeleteWallet()
    await mediator.closeAndDeleteWallet()
  })

  test('Make connection with mediator and requests mediation', async () => {
    aliceAgent = new Agent(aliceConfig)
    const aliceInboundTransporter = new PollingInboundTransporter()
    aliceAgent.setInboundTransporter(aliceInboundTransporter)
    aliceAgent.setOutboundTransporter(new HttpOutboundTransporter(aliceAgent))
    await aliceAgent.init()
    expect(aliceAgent)

    mediator = new Agent(mediatorConfig)
    const mediatorInBoundTransporter = new PollingInboundTransporter()
    mediator.setInboundTransporter(mediatorInBoundTransporter)
    mediator.setOutboundTransporter(new HttpOutboundTransporter(mediator))
    await mediator.init()
    // Create Mediation connection invitation
    const mediatorAliceInvitation = await mediator.connections.createConnection({ autoAcceptConnection: true })
    expect(mediatorAliceInvitation)
    // Connect agent with their mediator
    let aliceMediatorConnection = await aliceAgent.connections.receiveInvitation(mediatorAliceInvitation.invitation, {
      autoAcceptConnection: true,
      alias: 'mediator',
    })
    expect(aliceMediatorConnection)
    // allow connections to astablish
    aliceMediatorConnection = await aliceAgent.connections.returnWhenIsConnected(aliceMediatorConnection.id)
    expect(aliceMediatorConnection.isReady)
    // Start polling responses from this connection and wait for mediation granted
    aliceInboundTransporter.stop = true
    aliceInboundTransporter.start(aliceAgent, aliceMediatorConnection)

    // Once mediator is connected, mediation request can be sent
    const aliceMediationRecord = await aliceAgent.mediationRecipient.requestAndWaitForAcception(
      aliceMediatorConnection,
      aliceAgent.mediationRecipient.events,
      2000
    )

    // TODO: add expect cases for mediationRecords
    expect(aliceMediatorConnection)
    /*const aliceInboundConnection = await aliceAgent.mediationRecipient.getDefaultMediatorConnection()
    const aliceKeyAtAliceMediator = aliceInboundConnection?.verkey
    logger.test('aliceInboundConnection', aliceInboundConnection)

    bobMediatorConnection = await bobAgent.connections.getById(bobMediationRecord.connectionId)

    const bobInboundConnection = await bobAgent.mediationRecipient.getDefaultMediatorConnection()
    const bobKeyAtBobMediator = bobInboundConnection?.verkey
    console.log('bobKeyAtBobMediator: ' + bobKeyAtBobMediator)
    logger.test('bobInboundConnection', bobInboundConnection)

    // TODO This endpoint currently exists at mediator only for the testing purpose. It returns mediator's part of the pairwise connection.
    const mediatorConnectionAtAliceMediator = JSON.parse(
      await get(`${aliceAgent.getMediatorUrl()}/api/connections/${aliceKeyAtAliceMediator}`)
    )
    const mediatorConnectionAtBobMediator = JSON.parse(
      await get(`${bobAgent.getMediatorUrl()}/api/connections/${bobKeyAtBobMediator}`)
    )

    expect(aliceInboundConnection).toBeConnectedWith(mediatorConnectionAtAliceMediator)
    expect(bobInboundConnection).toBeConnectedWith(mediatorConnectionAtBobMediator)*/
  })

  test('Alice and Bob make a connection via mediator', async () => {
    // eslint-disable-next-line prefer-const
    let { invitation, connectionRecord: aliceAgentConnection } = await aliceAgent.connections.createConnection()

    let bobAgentConnection = await bobAgent.connections.receiveInvitation(invitation)

    aliceAgentConnection = await aliceAgent.connections.returnWhenIsConnected(aliceAgentConnection.id)

    bobAgentConnection = await bobAgent.connections.returnWhenIsConnected(bobAgentConnection.id)

    expect(aliceAgentConnection).toBeConnectedWith(bobAgentConnection)
    expect(bobAgentConnection).toBeConnectedWith(aliceAgentConnection)

    // We save this verkey to send message via this connection in the following test
    aliceAtAliceBobId = aliceAgentConnection.id
  })

  test('Send a message from Alice to Bob via mediator', async () => {
    // send message from Alice to Bob
    const aliceConnectionAtAliceBob = await aliceAgent.connections.find(aliceAtAliceBobId)
    if (!aliceConnectionAtAliceBob) {
      throw new Error(`There is no connection for id ${aliceAtAliceBobId}`)
    }

    logger.test('aliceConnectionAtAliceBob\n', aliceConnectionAtAliceBob)

    const message = 'hello, world'
    await aliceAgent.basicMessages.sendMessage(aliceConnectionAtAliceBob, message)

    const basicMessage = await waitForBasicMessage(bobAgent, {
      content: message,
    })

    expect(basicMessage.content).toBe(message)
  })
})

class PollingInboundTransporter implements InboundTransporter {
  public stop: boolean

  public constructor() {
    this.stop = false
  }

  public async start(agent: Agent, mediatorConnection?: ConnectionRecord) {
    this.stop = false

    if (mediatorConnection) {
      this.pollDownloadMessages(agent, mediatorConnection)
    }
  }

  private pollDownloadMessages(agent: Agent, mediatorConnection: ConnectionRecord) {
    const loop = async () => {
      while (!this.stop) {
        await agent.mediationRecipient.downloadMessages(mediatorConnection)
        await sleep(1000)
      }
    }
    new Promise(() => {
      loop()
    })
  }
}

class HttpOutboundTransporter implements OutboundTransporter {
  private agent: Agent

  public constructor(agent: Agent) {
    this.agent = agent
  }
  public async sendMessage(outboundPackage: OutboundPackage, receiveReply: boolean) {
    const { payload, endpoint } = outboundPackage

    if (!endpoint) {
      throw new Error(`Missing endpoint. I don't know how and where to send the message.`)
    }

    logger.debug(`Sending outbound message to connection ${outboundPackage.connection.id}`, outboundPackage.payload)

    if (receiveReply) {
      const response = await post(`${endpoint}`, JSON.stringify(payload))
      if (response) {
        logger.debug(`Response received:\n ${response}`)
        const wireMessage = JSON.parse(response)
        this.agent.receiveMessage(wireMessage)
      } else {
        logger.debug(`No response received.`)
      }
    } else {
      await post(`${endpoint}`, JSON.stringify(payload))
    }
  }
}
