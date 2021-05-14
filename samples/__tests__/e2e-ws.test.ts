import { Agent, InboundTransporter, WsOutboundTransporter } from '../../src'
import { get } from '../http'
import { getBaseConfig, toBeConnectedWith, waitForBasicMessage } from '../../src/__tests__/helpers'
import testLogger from '../../src/__tests__/logger'

const logger = testLogger

expect.extend({ toBeConnectedWith })

const aliceConfig = getBaseConfig('E2E Alice WebSockets', { mediatorUrl: 'http://localhost:3003' })
const bobConfig = getBaseConfig('E2E Bob WebSockets', { mediatorUrl: 'http://localhost:3004' })

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

  test('Alice and Bob make a connection with mediator', async () => {
    aliceAgent = new Agent(aliceConfig)
    aliceAgent.setInboundTransporter(new WsInboundTransporter())
    aliceAgent.setOutboundTransporter(new WsOutboundTransporter(aliceAgent))
    await aliceAgent.init()

    bobAgent = new Agent(bobConfig)
    bobAgent.setInboundTransporter(new WsInboundTransporter())
    bobAgent.setOutboundTransporter(new WsOutboundTransporter(bobAgent))
    await bobAgent.init()

    const aliceInbound = aliceAgent.routing.getInboundConnection()
    const aliceInboundConnection = aliceInbound?.connection
    const aliceKeyAtAliceMediator = aliceInboundConnection?.verkey
    logger.test('aliceInboundConnection', aliceInboundConnection)

    const bobInbound = bobAgent.routing.getInboundConnection()
    const bobInboundConnection = bobInbound?.connection
    const bobKeyAtBobMediator = bobInboundConnection?.verkey
    logger.test('bobInboundConnection', bobInboundConnection)

    // TODO This endpoint currently exists at mediator only for the testing purpose. It returns mediator's part of the pairwise connection.
    const mediatorConnectionAtAliceMediator = JSON.parse(
      await get(`${aliceAgent.getMediatorUrl()}/api/connections/${aliceKeyAtAliceMediator}`)
    )
    const mediatorConnectionAtBobMediator = JSON.parse(
      await get(`${bobAgent.getMediatorUrl()}/api/connections/${bobKeyAtBobMediator}`)
    )

    logger.test('mediatorConnectionAtAliceMediator', mediatorConnectionAtAliceMediator)
    logger.test('mediatorConnectionAtBobMediator', mediatorConnectionAtBobMediator)

    expect(aliceInboundConnection).toBeConnectedWith(mediatorConnectionAtAliceMediator)
    expect(bobInboundConnection).toBeConnectedWith(mediatorConnectionAtBobMediator)
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

class WsInboundTransporter implements InboundTransporter {
  public async start(agent: Agent) {
    await this.registerMediator(agent)
  }

  private async registerMediator(agent: Agent) {
    const mediatorUrl = agent.getMediatorUrl() || ''
    const mediatorInvitationUrl = await get(`${mediatorUrl}/invitation`)
    const { verkey: mediatorVerkey } = JSON.parse(await get(`${mediatorUrl}/`))

    await agent.routing.provision({
      verkey: mediatorVerkey,
      invitationUrl: mediatorInvitationUrl,
    })
  }
}
