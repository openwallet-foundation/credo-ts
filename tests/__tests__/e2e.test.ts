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
import { getBaseConfig, makeConnection, sleep, waitForBasicMessage } from '../../src/__tests__/helpers'
import logger from '../../src/__tests__/logger'
import cors from 'cors'
import { InMemoryMessageRepository } from '../../src/storage/InMemoryMessageRepository'
import { MessageRepository } from '../../src/storage/MessageRepository'
import { ReturnRouteTypes } from '../../src/decorators/transport/TransportDecorator'
import { HttpOutboundTransporter } from '../mediation-server'
import { Server } from 'http'

const recipientConfig = getBaseConfig('recipient', {
  host: 'http://localhost',
  port: 3002,
})
const mediatorConfig = getBaseConfig('mediator', {
  host: 'http://localhost',
  port: 3003,
})
const tedConfig = getBaseConfig('E2E ted', {
  host: 'http://localhost',
  port: 3003,
})

describe('with mediator', () => {
  let recipientAgent: Agent
  let mediatorAgent: Agent
  let recipientMediatorRecord: MediationRecord | undefined
  let tedAgent: Agent
  let tedRecipientConnection: ConnectionRecord
  const app = express()

  app.use(cors())
  app.use(express.json())
  app.use(
    express.text({
      type: ['application/ssi-agent-wire', 'text/plain'],
    })
  )
  app.set('json spaces', 2)

  const messageRepository = new InMemoryMessageRepository()

  //let recipientWallet: Wallet

  afterEach(async () => {
    console.log("After Each - Started")

    try{
      console.log("Wallet Cleanup - Started")

      await recipientAgent.closeAndDeleteWallet()
      await mediatorAgent.closeAndDeleteWallet()

    } catch(error){
      console.warn("After Each - Error closing wallets", error)
    } finally {
      console.log("Wallet Cleanup - Completed")
    }

    console.log("After Each - Completed")
  })

  afterAll(async () => {
    console.log("After All - Started")

    //Ensure the wallets have been closed and deleted
    try{
      console.log("Final Wallet Cleanup - Started")

      await recipientAgent.closeAndDeleteWallet()
      await mediatorAgent.closeAndDeleteWallet()

    } catch(error){
      console.warn("After All - Error closing wallets", error)
    } finally {
      console.log("Final Wallet Cleanup - Completed")
    }

    // Wait for messages to flush out
    await new Promise((r) => {
      setTimeout(r, 1000)
    })

    console.log("After All - Completed")
  })

  // test('recipient and mediator establish a connection and granted mediation', async () => {
  //   console.log("recipient and mediator establish a connection and granted mediation start")

  //   recipientAgent = new Agent(recipientConfig)
  //   recipientAgent.setInboundTransporter(new mockMobileInboundTransporter())
  //   recipientAgent.setOutboundTransporter(new mockMobileOutBoundTransporter(recipientAgent))
  //   await recipientAgent.init()

  //   mediatorAgent = new Agent(mediatorConfig, messageRepository)
  //   mediatorAgent.setInboundTransporter(new mockMediatorInBoundTransporter(app))
  //   mediatorAgent.setOutboundTransporter(new mockMediatorOutBoundTransporter())
  //   await mediatorAgent.init()


  //   const { agentAConnection: mediatorAgentConnection, agentBConnection: recipientAgentConnection } =
  //     await makeConnection(mediatorAgent, recipientAgent, {
  //       autoAcceptConnection: true,
  //     })
  //   expect(recipientAgentConnection).toBeConnectedWith(mediatorAgentConnection)
  //   expect(mediatorAgentConnection).toBeConnectedWith(recipientAgentConnection)
  //   expect(mediatorAgentConnection.isReady)
  //   let mediationRecord: MediationRecord = await recipientAgent.mediationRecipient.requestAndWaitForAcception(
  //     recipientAgentConnection,
  //     200000 // TODO: remove magic number
  //   )
  //   // test default mediator
  //   mediationRecord = await recipientAgent.mediationRecipient.setDefaultMediator(mediationRecord)
  //   const retrievedMediationRecord = await recipientAgent.mediationRecipient.getDefaultMediator()
  //   if (retrievedMediationRecord) {
  //     expect(retrievedMediationRecord.state).toBe(MediationState.Granted)
  //   } else {
  //     throw new Error()
  //   }
  //   const recipientMediatorConnection = await recipientAgent.mediationRecipient.getDefaultMediatorConnection()
  //   if (recipientMediatorConnection) {
  //     expect(recipientMediatorConnection?.isReady)
  //     const recipientMediatorRecord = await recipientAgent.mediationRecipient.findByConnectionId(
  //       recipientMediatorConnection.id
  //     )
  //     expect(recipientMediatorRecord?.state).toBe(MediationState.Granted)
  //   } else {
  //     throw new Error('no mediator connection found.')
  //   }

  //   await (recipientAgent.inboundTransporter as mockMobileInboundTransporter).stop()
  //   await (mediatorAgent.inboundTransporter as mockMediatorInBoundTransporter).stop()
  //   console.log("Cleanup - Started")

  //   try{
  //     console.log(typeof recipientAgent.closeAndDeleteWallet)
  //     await recipientAgent.closeAndDeleteWallet()

  //     console.log(typeof mediatorAgent.closeAndDeleteWallet)
  //     await mediatorAgent.closeAndDeleteWallet()
  //   } catch(error){
  //     console.warn("After Each - Error closing wallets", error)
  //   }

  //   console.log("Cleanup - Completed")
  //   console.log("recipient and mediator establish a connection and granted mediation end")
  // })

  test('recipient and mediator establish a connection and granted mediation with WebSockets', async () => {
    console.log("recipient and mediator establish a connection and granted mediation with WebSockets start")
    // websockets
    try{
      recipientAgent = new Agent(recipientConfig)
      const socketServer = new WebSocket.Server({ noServer: true})
      recipientAgent.setInboundTransporter(new WsInboundTransporter(socketServer))
      recipientAgent.setOutboundTransporter(new WsOutboundTransporter(recipientAgent))
      await recipientAgent.init()

      mediatorAgent = new Agent(mediatorConfig, messageRepository)
      const socketServer_ = new WebSocket.Server({ noServer: false, port: 3003 })
      mediatorAgent.setInboundTransporter(new WsInboundTransporter(socketServer_))
      mediatorAgent.setOutboundTransporter(new WsOutboundTransporter(mediatorAgent))
      await mediatorAgent.init()
    } catch (error){
      console.warn(error)
    }
    console.log("Agents configured")

    const { agentAConnection: mediatorAgentConnection, agentBConnection: recipientAgentConnection } =
      await makeConnection(mediatorAgent, recipientAgent, {
        autoAcceptConnection: true,
      })
    console.log("Agents connected")
    expect(recipientAgentConnection).toBeConnectedWith(mediatorAgentConnection)
    expect(mediatorAgentConnection).toBeConnectedWith(recipientAgentConnection)
    expect(mediatorAgentConnection.isReady)

    console.log("Connected, requesting and waiting for accept")
    let mediationRecord: MediationRecord = await recipientAgent.mediationRecipient.requestAndWaitForAcception(
      recipientAgentConnection,
      20000 // TODO: remove magic number
    )
    // test default mediator
    mediationRecord = await recipientAgent.mediationRecipient.setDefaultMediator(mediationRecord)
    const retrievedMediationRecord = await recipientAgent.mediationRecipient.getDefaultMediator()
    if (retrievedMediationRecord) {
      expect(retrievedMediationRecord.state).toBe(MediationState.Granted)
    } else {
      throw new Error()
    }

    const recipientMediatorConnection = await recipientAgent.mediationRecipient.getDefaultMediatorConnection()
    if (recipientMediatorConnection) {
      expect(recipientMediatorConnection?.isReady)
      const recipientMediatorRecord = await recipientAgent.mediationRecipient.findByConnectionId(
        recipientMediatorConnection.id
      )
      expect(recipientMediatorRecord?.state).toBe(MediationState.Granted)
    } else {
      throw new Error('no mediator connection found.')
    }

    console.log("Transport Cleanup - Started")

    await (recipientAgent.outboundTransporter as WsOutboundTransporter).stop()
    console.log("Closed Recipient Outbound Socket")
    await (recipientAgent.inboundTransporter as WsInboundTransporter).stop()

    await (mediatorAgent.outboundTransporter as WsOutboundTransporter).stop()
    console.log("Closed Mediator Outbound Socket")
    await (mediatorAgent.inboundTransporter as WsInboundTransporter).stop()

    console.log("Transport Cleanup - Completed")

    console.log("recipient and mediator establish a connection and granted mediation with WebSockets end")
  })
})
//   test('recipient and Ted make a connection via mediator', async () => {
//     // eslint-disable-next-line prefer-const
//     /*tedAgent = new Agent(tedConfig)
//     tedAgent.setOutboundTransporter(new HttpOutboundTransporter(tedAgent))
//     let { invitation, connectionRecord } = await recipientAgent.connections.createConnection(
//       {
//         autoAcceptConnection: true,
//         mediatorId: recipientMediatorRecord?.id
//       }
//     )
//     tedRecipientConnection = await tedAgent.connections.receiveInvitation(invitation)
//     const recipientTedConnection = await recipientAgent.connections.returnWhenIsConnected(connectionRecord.id)
//     tedRecipientConnection = await tedAgent.connections.returnWhenIsConnected(tedRecipientConnection.id)
//     expect(tedRecipientConnection.isReady)
//     expect(tedRecipientConnection).toBeConnectedWith(recipientTedConnection)
//     expect(recipientTedConnection).toBeConnectedWith(tedRecipientConnection)*/
//   })

//   test('Send a message from recipient to ted via mediator', async () => {
//     // send message from recipient to ted
//     /*const message = 'hello, world'
//     await recipientAgent.basicMessages.sendMessage(tedRecipientConnection, message)

//     const basicMessage = await waitForBasicMessage(mediatorAgent, {
//       content: message,
//     })

//     expect(basicMessage.content).toBe(message)*/
//   })
// })

// describe('websockets with mediator', () => {
//   /*let recipientAgent: Agent
//   let mediatorAgent: Agent

//   afterAll(async () => {
//     await recipientAgent.outboundTransporter?.stop()
//     await mediatorAgent.outboundTransporter?.stop()

//     // Wait for messages to flush out
//     await new Promise((r) => setTimeout(r, 1000))

//     await recipientAgent.closeAndDeleteWallet()
//     await mediatorAgent.closeAndDeleteWallet()
//   })*/

//   test('recipient and Bob make a connection with mediator from config', () => {
//     /*recipientAgent = new Agent(recipientConfig)
//     recipientAgent.setInboundTransporter(new WsInboundTransporter())
//     recipientAgent.setOutboundTransporter(new WsOutboundTransporter(recipientAgent))
//     await recipientAgent.init()

//     mediatorAgent = new Agent(mediatorConfig)
//     mediatorAgent.setInboundTransporter(new WsInboundTransporter())
//     mediatorAgent.setOutboundTransporter(new WsOutboundTransporter(mediatorAgent))
//     await mediatorAgent.init()*/
//   })
// })


// class mockMediatorInBoundTransporter implements InboundTransporter {
//   private app: Express
//   public server?: Server
//   public constructor(app: Express) {
//     this.app = app
//   }
//   public async start(agent: Agent) {
//     this.app.post('/msg', async (req, res) => {
//       const packedMessage = JSON.parse(req.body)
//       try {
//         const outboundMessage = await agent.receiveMessage(packedMessage)
//         if (outboundMessage) {
//           res.status(200).json(outboundMessage.payload).end()
//         } else {
//           res.status(200).end()
//         }
//       } catch (e) {
//         res.status(200).end()
//       }
//     })
//     this.server = this.app.listen(3002, () => {
//       //TODO: fix this hard coded port
//     })
//   }
//   public async stop(): Promise<void> {
//     this.server?.close()
//   }
// }

class mockMediatorOutBoundTransporter implements OutboundTransporter {
  public async start(): Promise<void> {
    // No custom start logic required
  }

  public async stop(): Promise<void> {
    // No custom stop logic required
  }

  public supportedSchemes = ['http', 'dicomm', 'https']

  public async sendMessage(outboundPackage: OutboundPackage) {
    const { connection, payload, endpoint, responseRequested } = outboundPackage
  }
}

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
  public connection?: ConnectionRecord

  public constructor() {
    this.run = false
  }
  public async start(agent: Agent) {
    this.run = true
    await this.pollDownloadMessages(agent)
  }

  public stop(): void {
    this.run = false
  }
  private async pollDownloadMessages(recipient: Agent, run = this.run) {
    if (run) {
      const connection = await recipient.mediationRecipient.getDefaultMediatorConnection()
      if (this.connection) {
        await recipient.mediationRecipient.downloadMessages(this.connection)
        await sleep(10000)
        await this.pollDownloadMessages(recipient)
      }
    }
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
    logger.debug("Closing Socket Server")
    const promise: Promise<void> = new Promise((resolve, reject) => {
      this.socketServer.close((error) => {
        if(error){
          logger.error("Error closing socket server")
          reject(error)
        }
        else{
          console.log("Socket Server closed")
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
