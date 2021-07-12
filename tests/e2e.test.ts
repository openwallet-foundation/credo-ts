import WebSocket from 'ws'

import { HttpOutboundTransporter, Agent, MediationState, WsOutboundTransporter } from '../src'
import { getBaseConfig, makeConnection } from '../src/__tests__/helpers'

import { HttpInboundTransporter } from './transport/HttpInboundTransport'
import { WsInboundTransporter } from './transport/WsInboundTransport'

const recipientConfig = getBaseConfig('E2E Recipient')
const mediatorConfig = getBaseConfig('E2E Mediator', {
  endpoint: 'http://localhost:3002',
  autoAcceptMediationRequests: true,
})

describe('mediator establishment', () => {
  let recipientAgent: Agent
  let mediatorAgent: Agent

  beforeEach(async () => {
    recipientAgent = new Agent(recipientConfig)
    mediatorAgent = new Agent(mediatorConfig)
  })

  afterEach(async () => {
    await recipientAgent.shutdown({ deleteWallet: true })
    await mediatorAgent.shutdown({ deleteWallet: true })
  })

  test('recipient and mediator establish a connection and granted mediation with HTTP', async () => {
    // Recipient Setup
    recipientAgent.setOutboundTransporter(new HttpOutboundTransporter())
    await recipientAgent.initialize()

    // Mediator Setup
    mediatorAgent.setInboundTransporter(new HttpInboundTransporter())
    mediatorAgent.setOutboundTransporter(new HttpOutboundTransporter())
    await mediatorAgent.initialize()

    const { agentAConnection: mediatorAgentConnection, agentBConnection: recipientAgentConnection } =
      await makeConnection(mediatorAgent, recipientAgent, {
        autoAcceptConnection: true,
      })
    expect(recipientAgentConnection).toBeConnectedWith(mediatorAgentConnection)
    expect(mediatorAgentConnection).toBeConnectedWith(recipientAgentConnection)
    expect(mediatorAgentConnection.isReady)
    const mediationRecord = await recipientAgent.mediationRecipient.requestAndAwaitGrant(recipientAgentConnection)
    expect(mediationRecord.state).toBe(MediationState.Granted)
  })

  test('recipient and mediator establish a connection and granted mediation with WebSockets', async () => {
    // Recipient Setup
    recipientAgent.setOutboundTransporter(new WsOutboundTransporter())
    await recipientAgent.initialize()

    // Mediator Setup
    const socketServer = new WebSocket.Server({ port: 3002 })
    mediatorAgent.setInboundTransporter(new WsInboundTransporter(socketServer))
    mediatorAgent.setOutboundTransporter(new WsOutboundTransporter())
    await mediatorAgent.initialize()

    const { agentAConnection: mediatorAgentConnection, agentBConnection: recipientAgentConnection } =
      await makeConnection(mediatorAgent, recipientAgent, {
        autoAcceptConnection: true,
      })
    expect(recipientAgentConnection).toBeConnectedWith(mediatorAgentConnection)
    expect(mediatorAgentConnection).toBeConnectedWith(recipientAgentConnection)
    expect(mediatorAgentConnection.isReady)

    const mediationRecord = await recipientAgent.mediationRecipient.requestAndAwaitGrant(recipientAgentConnection)
    expect(mediationRecord.state).toBe(MediationState.Granted)
  })
})
