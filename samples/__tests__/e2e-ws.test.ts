import WebSocket from 'ws'
import { Agent, ConnectionRecord, ConsoleLogger, InboundTransporter, LogLevel, OutboundTransporter } from '../../src'
import { OutboundPackage, InitConfig } from '../../src/types'
import { get } from '../http'
import { toBeConnectedWith, waitForBasicMessage } from '../../src/__tests__/helpers'
import indy from 'indy-sdk'
import testLogger from '../../src/__tests__/logger'
import { WebSocketTransport } from '../../src/agent/TransportService'

const logger = new ConsoleLogger(LogLevel.test)

expect.extend({ toBeConnectedWith })

const aliceConfig: InitConfig = {
  label: 'e2e Alice',
  mediatorUrl: 'http://localhost:3003',
  walletConfig: { id: 'e2e-alice-ws' },
  walletCredentials: { key: '00000000000000000000000000000Test01' },
  autoAcceptConnections: true,
  logger: logger,
  indy,
}

const bobConfig: InitConfig = {
  label: 'e2e Bob',
  mediatorUrl: 'http://localhost:3004',
  walletConfig: { id: 'e2e-bob-ws' },
  walletCredentials: { key: '00000000000000000000000000000Test02' },
  autoAcceptConnections: true,
  logger: logger,
  indy,
}

describe('websockets with mediator', () => {
  let aliceAgent: Agent
  let bobAgent: Agent
  let aliceAtAliceBobId: string

  afterAll(async () => {
    ;(aliceAgent.getOutboundTransporter() as WsOutboundTransporter).stop()
    ;(bobAgent.getOutboundTransporter() as WsOutboundTransporter).stop()

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

class WsOutboundTransporter implements OutboundTransporter {
  private transportTable: Map<string, WebSocket> = new Map<string, WebSocket>()
  private agent: Agent

  public supportedSchemes = ['ws']

  public constructor(agent: Agent) {
    this.agent = agent
  }

  public async sendMessage(outboundPackage: OutboundPackage) {
    const { connection, payload, transport } = outboundPackage
    logger.debug(`Sending outbound message to connection ${connection.id} over ${transport?.type} transport.`, payload)

    if (transport instanceof WebSocketTransport) {
      const socket = await this.resolveSocket(connection, transport)
      socket.send(JSON.stringify(payload))
    } else {
      throw new Error(`Unsupported transport ${transport?.type}.`)
    }
  }

  private async resolveSocket(connection: ConnectionRecord, transport: WebSocketTransport) {
    if (transport.socket?.readyState === WebSocket.OPEN) {
      return transport.socket
    } else {
      let socket = this.transportTable.get(connection.id)
      if (!socket) {
        if (!transport.endpoint) {
          throw new Error(`Missing endpoint. I don't know how and where to send the message.`)
        }
        socket = await createSocketConnection(transport.endpoint)
        this.transportTable.set(connection.id, socket)
        this.listenOnWebSocketMessages(this.agent, socket)
      }

      if (socket.readyState !== WebSocket.OPEN) {
        throw new Error('Socket is not open.')
      }
      return socket
    }
  }

  private listenOnWebSocketMessages(agent: Agent, socket: WebSocket) {
    socket.addEventListener('message', (event: any) => {
      logger.debug('WebSocket message event received.', { url: event.target.url, data: event.data })
      agent.receiveMessage(JSON.parse(event.data))
    })
  }

  public stop() {
    this.transportTable.forEach((socket) => {
      socket.removeAllListeners()
      socket.close()
    })
  }
}

function createSocketConnection(endpoint: string): Promise<WebSocket> {
  if (!endpoint) {
    throw new Error('Mediator URL is missing.')
  }
  return new Promise((resolve, reject) => {
    logger.debug('Connecting to mediator via WebSocket')
    const socket = new WebSocket(endpoint)
    if (!socket) {
      throw new Error('WebSocket has not been initialized.')
    }
    socket.onopen = () => {
      logger.debug('Client connected')
      resolve(socket)
    }
    socket.onerror = (e) => {
      logger.debug('Client connection failed')
      reject(e)
    }
  })
}
