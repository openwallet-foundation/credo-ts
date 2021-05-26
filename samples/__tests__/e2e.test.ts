import { Agent,  ConnectionRecord, HttpOutboundTransporter, InboundTransporter, WsOutboundTransporter } from '../../src'
import { get } from '../http'
import { getBaseConfig, sleep, waitForBasicMessage } from '../../src/__tests__/helpers'
import logger from '../../src/__tests__/logger'

const aliceConfig = getBaseConfig('E2E Alice', {
  host: 'http://localhost',
  port: 3001,
})

const bobConfig = getBaseConfig('E2E Bob', {
  host: 'http://localhost',
  port: 3002,
})

describe('with mediator', () => {
  let aliceAgent: Agent
  let bobAgent: Agent
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

    // Wait for messages to flush out
    await new Promise((r) => setTimeout(r, 1000))

    await aliceAgent.closeAndDeleteWallet()
    await bobAgent.closeAndDeleteWallet()
  })

  test('Alice and Bob make a connection with mediator', async () => {
    aliceAgent = new Agent(aliceConfig)
    aliceAgent.setInboundTransporter(new PollingInboundTransporter())
    aliceAgent.setOutboundTransporter(new HttpOutboundTransporter(aliceAgent))
    await aliceAgent.init()

    bobAgent = new Agent(bobConfig)
    bobAgent.setInboundTransporter(new PollingInboundTransporter())
    bobAgent.setOutboundTransporter(new HttpOutboundTransporter(bobAgent))
    await bobAgent.init()

    const aliceInboundConnection = await aliceAgent.mediationRecipient.getDefaultMediatorConnection()
    const aliceKeyAtAliceMediator = aliceInboundConnection?.verkey
    logger.test('aliceInboundConnection', aliceInboundConnection)

    const bobInbound = bobAgent.mediationRecipient.getInboundConnection()
    const bobInboundConnection = bobInbound?.connection
    const bobKeyAtBobMediator = bobInboundConnection?.verkey
    logger.test('bobInboundConnection', bobInboundConnection)
    const aliceMediatorConnection = await aliceAgent.mediationRecipient.getDefaultMediatorConnection()
    const bobMediatorConnection = await bobAgent.mediationRecipient.getDefaultMediatorConnection()

    // TODO This endpoint currently exists at mediator only for the testing purpose. It returns mediator's part of the pairwise connection.
    const mediatorConnectionAtAliceMediator = JSON.parse(
      await get(`${aliceAgent.getMediatorUrl()}/api/connections/${bobMediatorConnection?.verkey}`)
    )
    const mediatorConnectionAtBobMediator = JSON.parse(
      await get(`${bobAgent.getMediatorUrl()}/api/connections/${bobMediatorConnection?.verkey}`)
    )

    logger.test('mediatorConnectionAtAliceMediator', mediatorConnectionAtAliceMediator)
    logger.test('mediatorConnectionAtBobMediator', mediatorConnectionAtBobMediator)

    expect(aliceMediatorConnection).toBeConnectedWith(mediatorConnectionAtAliceMediator)
    expect(bobMediatorConnection).toBeConnectedWith(mediatorConnectionAtBobMediator)
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
    const aliceConnectionAtAliceBob = await aliceAgent.connections.getById(aliceAtAliceBobId)

    logger.test('aliceConnectionAtAliceBob\n', aliceConnectionAtAliceBob)

    const message = 'hello, world'
    await aliceAgent.basicMessages.sendMessage(aliceConnectionAtAliceBob, message)

    const basicMessage = await waitForBasicMessage(bobAgent, {
      content: message,
    })

    expect(basicMessage.content).toBe(message)
  })
})

describe('websockets with mediator', () => {
  let aliceAgent: Agent
  let bobAgent: Agent
  let aliceAtAliceBobId: string

  afterAll(async () => {
    await aliceAgent.outboundTransporter?.stop()
    await bobAgent.outboundTransporter?.stop()

    // Wait for messages to flush out
    await new Promise((r) => setTimeout(r, 1000))

    await aliceAgent.closeAndDeleteWallet()
    await bobAgent.closeAndDeleteWallet()
  })

  test('Alice and Bob make a connection with mediator from config', async () => {
    aliceAgent = new Agent(aliceConfig)
    aliceAgent.setInboundTransporter(new WsInboundTransporter())
    aliceAgent.setOutboundTransporter(new WsOutboundTransporter(aliceAgent))
    await aliceAgent.init()

    bobAgent = new Agent(bobConfig)
    bobAgent.setInboundTransporter(new WsInboundTransporter())
    bobAgent.setOutboundTransporter(new WsOutboundTransporter(bobAgent))
    await bobAgent.init()
  })
})

class PollingInboundTransporter implements InboundTransporter {
  public stop: boolean
  public connection?: ConnectionRecord

  public constructor() {
    this.stop = true
  }

  public async init(agent:Agent){
    await this.registerMediator(agent)
  }

  public async start(agent: Agent) {
    if (this.connection) {
      this.stop = false
      this.pollDownloadMessages(agent, this.connection)
    }
  }

  public async registerMediator(recipient: Agent, mediator:Agent) {
    const mediatorUrl = agent.getMediatorUrl() || ''
    let { invitation, connectionRecord: aliceAgentConnection } = await agent.connections.createConnection()
    const mediatorInvitationUrl = invitation
    // create connection first

    let bobAgentConnection = await bobAgent.connections.receiveInvitation(invitation)

    aliceAgentConnection = await aliceAgent.connections.returnWhenIsConnected(aliceAgentConnection.id)

    bobAgentConnection = await bobAgent.connections.returnWhenIsConnected(bobAgentConnection.id)
    await agent.mediationRecipient.requestMediation({
      connection
    })
    this.pollDownloadMessages(agent, mediatorConnection)
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

class WsInboundTransporter implements InboundTransporter {
  public async start(agent: Agent) {
    await this.registerMediator(agent)
  }

  private async registerMediator(agent: Agent) {
    const mediatorUrl = agent.getMediatorUrl() || ''
    const mediatorInvitationUrl = await get(`${mediatorUrl}/invitation`)
    const { verkey: mediatorVerkey } = JSON.parse(await get(`${mediatorUrl}/`))

    // await agent.routing.provision({
    //   verkey: mediatorVerkey,
    //   invitationUrl: mediatorInvitationUrl,
    // })
  }
}
