import express, { Express } from 'express'
import WebSocket from 'ws'
import fetch from 'node-fetch'
import {
  Agent,
  assertConnection,
  Connection,
  ConnectionRecord,
  ConnectionState,
  InboundTransporter,
  MediationRecord,
  MediationState,
  OutboundPackage,
  OutboundTransporter,
  WsOutboundTransporter,
  WebSocketTransportSession,
} from '../../src'
import testLogger, { TestLogger } from '../../src/__tests__/logger'
import { get } from '../http'
import {
  getBaseConfig,
  makeConnection,
  makeInBoundTransporter,
  mockOutBoundTransporter,
  makeTransport,
  sleep,
  waitForBasicMessage,
  mockInBoundTransporter,
  MockMediatorOutboundTransporter,
} from '../../src/__tests__/helpers'
import logger from '../../src/__tests__/logger'
import cors from 'cors'
import { InMemoryMessageRepository } from '../../src/storage/InMemoryMessageRepository'
import { MessageRepository } from '../../src/storage/MessageRepository'
import { ReturnRouteTypes } from '../../src/decorators/transport/TransportDecorator'
import { HttpOutboundTransporter } from '../mediation-server'
import { Server } from 'http'
import { noop, timer } from 'rxjs'

const recipientConfig = getBaseConfig('recipient')
const mediatorConfig = getBaseConfig('mediator', {
  host: 'http://localhost',
  port: 3002,
})
const tedConfig = getBaseConfig('ted', {
  host: 'http://localhost',
  port: 3003,
})

describe('mediator establishment', () => {
  let recipientAgent: Agent
  let mediatorAgent: Agent
  beforeAll((done) => {
    done()
  })
  beforeEach(async () => {
    recipientAgent = new Agent(recipientConfig)
    mediatorAgent = new Agent(mediatorConfig, new InMemoryMessageRepository())
  })

  afterEach(async () => {
    try {
      await recipientAgent.closeAndDeleteWallet()
    } catch (e) {
      noop()
    }
    try {
      await mediatorAgent.closeAndDeleteWallet()
    } catch (e) {
      noop()
    }
  })
  afterAll(async (done) => {
    try {
      await recipientAgent.closeAndDeleteWallet()
    } catch (e) {
      noop()
    }
    try {
      await mediatorAgent.closeAndDeleteWallet()
    } catch (e) {
      noop()
    }
    done()
  })
  test('recipient and mediator establish a connection and granted mediation', async () => {
    //console.log('recipient and mediator establish a connection and granted mediation start')
    await makeTransport(
      recipientAgent,
      new mockMobileInboundTransporter(),
      new mockMobileOutBoundTransporter(recipientAgent)
    )
    await makeTransport(mediatorAgent, makeInBoundTransporter(), new mockOutBoundTransporter(mediatorAgent))

    const { agentAConnection: mediatorAgentConnection, agentBConnection: recipientAgentConnection } =
      await makeConnection(mediatorAgent, recipientAgent, {
        autoAcceptConnection: true,
      })
    expect(recipientAgentConnection).toBeConnectedWith(mediatorAgentConnection)
    expect(mediatorAgentConnection).toBeConnectedWith(recipientAgentConnection)
    expect(mediatorAgentConnection.isReady)
    console.log('mediatorAgent connection is ready!')
    const mediationRecord: MediationRecord = await recipientAgent.mediationRecipient.requestAndAwaitGrant(
      recipientAgentConnection
    )
    expect(mediationRecord.state).toBe(MediationState.Granted)

    try {
      await (recipientAgent.inboundTransporter as mockMobileInboundTransporter).stop()
    } catch (e) {
      noop()
    }
    try {
      await (mediatorAgent.inboundTransporter as mockInBoundTransporter).stop()
    } catch (e) {
      noop()
    }
  })

  test('recipient and mediator establish a connection and granted mediation with WebSockets', async () => {
    const socketServer = new WebSocket.Server({ noServer: true })
    await makeTransport(
      recipientAgent,
      new WsInboundTransporter(socketServer),
      new WsOutboundTransporter(recipientAgent)
    )
    const socketServer_ = new WebSocket.Server({ noServer: false, port: 3002 })
    await makeTransport(
      mediatorAgent,
      new WsInboundTransporter(socketServer_),
      new WsOutboundTransporter(mediatorAgent)
    )

    const { agentAConnection: mediatorAgentConnection, agentBConnection: recipientAgentConnection } =
      await makeConnection(mediatorAgent, recipientAgent, {
        autoAcceptConnection: true,
      })
    //console.log('Agents connected')
    expect(recipientAgentConnection).toBeConnectedWith(mediatorAgentConnection)
    expect(mediatorAgentConnection).toBeConnectedWith(recipientAgentConnection)
    expect(mediatorAgentConnection.isReady)

    //console.log('Connected, requesting and waiting for accept')
    const mediationRecord: MediationRecord = await recipientAgent.mediationRecipient.requestAndAwaitGrant(
      recipientAgentConnection
    )
    expect(mediationRecord.state).toBe(MediationState.Granted)
    try {
      await (recipientAgent.outboundTransporter as WsOutboundTransporter).stop()
    } catch (e) {
      noop()
    }
    try {
      await (recipientAgent.inboundTransporter as WsInboundTransporter).stop()
    } catch (e) {
      noop()
    }
    try {
      await (mediatorAgent.outboundTransporter as WsOutboundTransporter).stop()
    } catch (e) {
      noop()
    }
    try {
      await (mediatorAgent.inboundTransporter as WsInboundTransporter).stop()
    } catch (e) {
      noop()
    }
  })
})
/*describe('mediator features', () => {
  let recipientAgent: Agent
  let mediatorAgent: Agent
  let mediationRecord: MediationRecord
  let tedAgent: Agent
  beforeAll(done => {done()})
  beforeEach(async () => {
    try {
      recipientAgent = new Agent(recipientConfig)
      mediatorAgent = new Agent(mediatorConfig, new InMemoryMessageRepository())
      tedAgent = new Agent(tedConfig, new InMemoryMessageRepository())
      await makeTransport(
        recipientAgent,
        new mockMobileInboundTransporter(),
        new mockMobileOutBoundTransporter(recipientAgent)
      )
      await makeTransport(mediatorAgent, makeInBoundTransporter(), new MockMediatorOutboundTransporter(mediatorAgent))
      await makeTransport(tedAgent, makeInBoundTransporter(), new mockOutBoundTransporter(tedAgent))
      const { agentAConnection: mediatorAgentConnection, agentBConnection: recipientAgentConnection } =
        await makeConnection(mediatorAgent, recipientAgent, {
          autoAcceptConnection: true,
        })
      mediationRecord = await recipientAgent.mediationRecipient.requestAndAwaitGrant(recipientAgentConnection)
    } catch (e) {
      throw e
    }
  })
  afterEach(async () => {
    try {
      await (recipientAgent.inboundTransporter as mockMobileInboundTransporter).stop()
    } catch (e) {}
    try {
      await (mediatorAgent.inboundTransporter as mockInBoundTransporter).stop()
    } catch (e) {}
    try {
      await (tedAgent.inboundTransporter as mockInBoundTransporter).stop()
    } catch (e) {}
    try {
      await recipientAgent.closeAndDeleteWallet()
    } catch (e) {}
    try {
      await mediatorAgent.closeAndDeleteWallet()
    } catch (e) {}
    try {
      await tedAgent.closeAndDeleteWallet()
    } catch (e) {}
    afterAll(async done =>{
      try { await recipientAgent.closeAndDeleteWallet()} catch (e){}
      try { await mediatorAgent.closeAndDeleteWallet()} catch (e){}
      try { await tedAgent.closeAndDeleteWallet()} catch (e){}
      done()
    })
  })

  test('should set default mediator and retrieve', async () => {
    expect.assertions(1)
    await recipientAgent.mediationRecipient.setDefaultMediator(mediationRecord)
    const retrievedMediationRecord = await recipientAgent.mediationRecipient.getDefaultMediator()
    expect(mediationRecord).toBe(retrievedMediationRecord)
  })

  test('should get default mediator connection, and get default mediator from connection id', async () => {
    await recipientAgent.mediationRecipient.setDefaultMediator(mediationRecord)
    const recipientMediatorConnection = await recipientAgent.mediationRecipient.getDefaultMediatorConnection()
    if (recipientMediatorConnection) {
      expect(recipientMediatorConnection?.isReady)
      const recipientMediatorRecord = await recipientAgent.mediationRecipient.findByConnectionId(
        recipientMediatorConnection.id
      )
    } else {
      throw new Error('no mediator connection found.')
    }
  })
  test('recipient and Ted make a connection via mediator', async () => {
    await recipientAgent.mediationRecipient.setDefaultMediator(mediationRecord)
    let { invitation, connectionRecord: agentAConnection } = await recipientAgent.connections.createConnection({
      autoAcceptConnection: true,
      mediatorId: mediationRecord.id,
    })
    let agentBConnection = await tedAgent.connections.receiveInvitation(invitation, { autoAcceptConnection: true })
    agentAConnection = await recipientAgent.connections.returnWhenIsConnected(agentAConnection.id)
    agentBConnection = await tedAgent.connections.returnWhenIsConnected(agentBConnection.id)
    expect(agentAConnection).toBeConnectedWith(agentBConnection)
    expect(agentBConnection).toBeConnectedWith(agentAConnection)
    expect(agentBConnection.isReady)
  })

  /*test('Send a message from recipient to ted via mediator', async () => {
    await recipientAgent.mediationRecipient.setDefaultMediator(mediationRecord)
    const { agentAConnection: recipientAgentConnection, agentBConnection: tedRecipientConnection } =
    await makeConnection(recipientAgent, tedAgent, {
      autoAcceptConnection: true,
    })
     // send message from recipient to ted
    const message = 'hello, world'
     await recipientAgent.basicMessages.sendMessage(tedRecipientConnection, message)
     const basicMessage = await waitForBasicMessage(recipientAgent, {
       content: message,
    })

     expect(basicMessage.content).toBe(message)
   })
})*/

class mockMobileOutBoundTransporter implements OutboundTransporter {
  private agent: Agent

  public constructor(agent: Agent) {
    this.agent = agent
  }
  public async start(): Promise<void> {
    // No custom start logic required
  }

  public async stop(): Promise<void> {
    // No custom stop logic required
  }

  public supportedSchemes = ['http', 'dicomm', 'https']

  public async sendMessage(outboundPackage: OutboundPackage) {
    const { connection, payload, endpoint, responseRequested } = outboundPackage
    if (!endpoint || endpoint == 'didcomm:transport/queue') {
      throw new Error(`Missing endpoint. I don't know how and where to send the message.`)
    }
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/ssi-agent-wire',
        },
        body: JSON.stringify(payload),
      })
      const data = await response.text()
      if (data) {
        testLogger.debug(`Response received:\n ${response}`)
        const wireMessage = JSON.parse(data)
        this.agent.receiveMessage(wireMessage)
      } else {
        testLogger.debug(`No response received.`)
      }
    } catch (e) {
      testLogger.debug('error sending message', e)
      throw e
    }
  }
}

class mockMobileInboundTransporter implements InboundTransporter {
  public run: boolean

  public constructor() {
    this.run = false
  }
  public async start(agent: Agent) {
    this.run = true
    await this.pollDownloadMessages(agent)
  }

  public async stop(): Promise<void> {
    this.run = false
  }

  private async pollDownloadMessages(recipient: Agent, run = this.run, connection_?: ConnectionRecord) {
    setInterval(async () => {
      if (this.run) {
        const connection = connection_ ?? (await recipient.mediationRecipient.getDefaultMediatorConnection())
        if (connection?.state == 'complete') {
          await recipient.mediationRecipient.downloadMessages(connection)
        }
      }
    }, 200)
  }
}

export class WsInboundTransporter implements InboundTransporter {
  private socketServer: WebSocket.Server

  // We're using a `socketId` just for the prevention of calling the connection handler twice.
  private socketIds: Record<string, unknown> = {}

  public constructor(socketServer: WebSocket.Server) {
    this.socketServer = socketServer
  }

  public async start(agent: Agent) {
    this.socketServer.on('connection', (socket: any, _: Express.Request, socketId: string) => {
      if (!this.socketIds[socketId]) {
        logger.debug(`Saving new socket with id ${socketId}.`)
        this.socketIds[socketId] = socket
        this.listenOnWebSocketMessages(agent, socket)
        socket.on('close', () => logger.debug('Socket closed.'))
      } else {
        logger.debug(`Socket with id ${socketId} already exists.`)
      }
    })
  }

  public async stop() {
    logger.debug('Closing Socket Server')
    const promise: Promise<void> = new Promise((resolve, reject) => {
      this.socketServer.close((error) => {
        if (error) {
          logger.error('Error closing socket server')
          reject(error)
        } else {
          //console.log('Socket Server closed')
          resolve()
        }
      })
    })

    return promise
  }

  private listenOnWebSocketMessages(agent: Agent, socket: WebSocket) {
    socket.addEventListener('message', async (event: any) => {
      logger.debug('WebSocket message event received.', { url: event.target.url, data: event.data })
      // @ts-expect-error Property 'dispatchEvent' is missing in type WebSocket imported from 'ws' module but required in type 'WebSocket'.
      const session = new WebSocketTransportSession(socket)
      const outboundMessage = await agent.receiveMessage(JSON.parse(event.data), session)
      if (outboundMessage) {
        socket.send(JSON.stringify(outboundMessage.payload))
      }
    })
  }
}
