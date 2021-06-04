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
} from '../../src'
import testLogger, { TestLogger } from '../../src/__tests__/logger'
import { get } from '../http'
import { getBaseConfig, makeConnection, sleep, waitForBasicMessage } from '../../src/__tests__/helpers'
import logger from '../../src/__tests__/logger'
import cors from 'cors'
import { WsInboundTransporter } from '../mediator-ws'
import { InMemoryMessageRepository } from '../../src/storage/InMemoryMessageRepository'
import { MessageRepository } from '../../src/storage/MessageRepository'
import { ReturnRouteTypes } from '../../src/decorators/transport/TransportDecorator'
import { HttpOutboundTransporter } from '../mediation-server'

const recipientConfig = getBaseConfig('recipient')
const mediatorConfig = getBaseConfig('mediator', {
  host: 'http://localhost',
  port: 3002,
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

  beforeAll(async () => {
    //recipientConfig = new AgentConfig(recipientConfig)
    //recipientWallet = new IndyWallet(recipientConfig)
    //await recipientWallet.init()
  })
  afterAll(async () => {
    ;(recipientAgent.inboundTransporter as mockMobileInboundTransporter).stop()

    // Wait for messages to flush out
    await new Promise((r) => setTimeout(r, 1000))

    await recipientAgent.closeAndDeleteWallet()
    await mediatorAgent.closeAndDeleteWallet()
  })

  test('recipient and mediator establish a connection and granted mediation', async () => {
    recipientAgent = new Agent(recipientConfig)
    recipientAgent.setInboundTransporter(new mockMobileInboundTransporter())
    recipientAgent.setOutboundTransporter(new mockMobileOutBoundTransporter(recipientAgent))
    await recipientAgent.init()

    mediatorAgent = new Agent(mediatorConfig, messageRepository)
    mediatorAgent.setInboundTransporter(new mockMediatorInBoundTransporter(app))
    mediatorAgent.setOutboundTransporter(new mockMediatorOutBoundTransporter())
    await mediatorAgent.init()
    await (recipientAgent.inboundTransporter as mockMobileInboundTransporter).stop()
    recipientAgent.inboundTransporter = new mockMobileInboundTransporter()
    const { agentAConnection: mediatorAgentConnection , agentBConnection: recipientAgentConnection } =
    await makeConnection(mediatorAgent, recipientAgent, {
      autoAcceptConnection: true,
    })
    expect(recipientAgentConnection).toBeConnectedWith(mediatorAgentConnection)
    expect(mediatorAgentConnection).toBeConnectedWith(recipientAgentConnection)
    expect(mediatorAgentConnection.isReady)
    let mediationRecord: MediationRecord = await recipientAgent.mediationRecipient.requestAndWaitForAcception(
      recipientAgentConnection,
      200000
    )
    mediationRecord = await recipientAgent.mediationRecipient.setDefaultMediator(mediationRecord)
    let retrievedMediationRecord = await recipientAgent.mediationRecipient.getDefaultMediator()
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
    //await recipientAgent.inboundTransporter.start(recipientAgent)
    //await (recipientAgent.inboundTransporter as mockMobileInboundTransporter).stop()
  })

  test('recipient and mediator establish a connection and granted mediation with WebSockets', async () => {
    // websockets
    //const socketServer = new WebSocket.Server({ noServer: true })
    //recipientAgent.setInboundTransporter(new WsInboundTransporter(socketServer))
    //recipientAgent.setOutboundTransporter(new WsOutboundTransporter(recipientAgent))
    //await recipientAgent.init()

    /*const mediatorAgent_ = new Agent(mediatorConfig, messageRepository)
    const socketServer_ = new WebSocket.Server({ noServer: false })
    mediatorAgent_.setInboundTransporter(new WsInboundTransporter(socketServer_))
    mediatorAgent_.setOutboundTransporter(new WsOutboundTransporter(mediatorAgent_))
    await mediatorAgent_.init()

    const { agentAConnection: recipientAgentConnection, agentBConnection: mediatorAgentConnection } =
      await makeConnection(recipientAgent_, mediatorAgent_, {
        autoAcceptConnection: true,
      })
      expect(recipientAgentConnection).toBeConnectedWith(mediatorAgentConnection)
      expect(mediatorAgentConnection).toBeConnectedWith(recipientAgentConnection)
      expect(mediatorAgentConnection.isReady)
      let mediationRecord = await recipientAgent_.mediationRecipient.requestAndWaitForAcception(
        recipientAgentConnection,
        200000 // TODO: remove hard magic number
      )
      mediationRecord = await recipientAgent_.mediationRecipient.setDefaultMediator(mediationRecord)
      // expects should be a independent test, but this will do for now...
      let mediationRecord_ = await recipientAgent_.mediationRecipient.getDefaultMediator()
      if (mediationRecord_) {
        expect(mediationRecord_.state).toBe(MediationState.Granted)
      } else {
        throw new Error()
      }
      const recipientMediatorConnection = await recipientAgent_.mediationRecipient.getDefaultMediatorConnection()
      if (recipientMediatorConnection) {
        expect(recipientMediatorConnection?.isReady)
        const recipientMediatorRecord = await recipientAgent_.mediationRecipient.findByConnectionId(
          recipientMediatorConnection.id
        )
        expect(recipientMediatorRecord?.state).toBe(MediationState.Granted)
      } else {
        throw new Error('no mediator connection found.')
      }*/
  })

  test('recipient and Ted make a connection via mediator', async () => {
    // eslint-disable-next-line prefer-const
    /*tedAgent = new Agent(tedConfig)
    tedAgent.setOutboundTransporter(new HttpOutboundTransporter(tedAgent))
    let { invitation, connectionRecord } = await recipientAgent.connections.createConnection(
      {
        autoAcceptConnection: true,
        mediatorId: recipientMediatorRecord?.id
      }
    )
    tedRecipientConnection = await tedAgent.connections.receiveInvitation(invitation)
    const recipientTedConnection = await recipientAgent.connections.returnWhenIsConnected(connectionRecord.id)
    tedRecipientConnection = await tedAgent.connections.returnWhenIsConnected(tedRecipientConnection.id)
    expect(tedRecipientConnection.isReady)
    expect(tedRecipientConnection).toBeConnectedWith(recipientTedConnection)
    expect(recipientTedConnection).toBeConnectedWith(tedRecipientConnection)*/
  })

  test('Send a message from recipient to ted via mediator', async () => {
    // send message from recipient to ted
    /*const message = 'hello, world'
    await recipientAgent.basicMessages.sendMessage(tedRecipientConnection, message)

    const basicMessage = await waitForBasicMessage(mediatorAgent, {
      content: message,
    })

    expect(basicMessage.content).toBe(message)*/
  })
})

describe('websockets with mediator', () => {
  /*let recipientAgent: Agent
  let mediatorAgent: Agent

  afterAll(async () => {
    await recipientAgent.outboundTransporter?.stop()
    await mediatorAgent.outboundTransporter?.stop()

    // Wait for messages to flush out
    await new Promise((r) => setTimeout(r, 1000))

    await recipientAgent.closeAndDeleteWallet()
    await mediatorAgent.closeAndDeleteWallet()
  })*/

  test('recipient and Bob make a connection with mediator from config', () => {
    /*recipientAgent = new Agent(recipientConfig)
    recipientAgent.setInboundTransporter(new WsInboundTransporter())
    recipientAgent.setOutboundTransporter(new WsOutboundTransporter(recipientAgent))
    await recipientAgent.init()

    mediatorAgent = new Agent(mediatorConfig)
    mediatorAgent.setInboundTransporter(new WsInboundTransporter())
    mediatorAgent.setOutboundTransporter(new WsOutboundTransporter(mediatorAgent))
    await mediatorAgent.init()*/
  })
})
class mockMediatorInBoundTransporter implements InboundTransporter {
  private app: Express
  public constructor(app: Express) {
    this.app = app
  }
  public async start(agent: Agent) {
    this.app.post('/msg', async (req, res) => {
      const packedMessage = JSON.parse(req.body)
      try {
        const outboundMessage = await agent.receiveMessage(packedMessage)
        if (outboundMessage) {
          res.status(200).json(outboundMessage.payload).end()
        } else {
          res.status(200).end()
        }
      } catch (e) {
        res.status(200).end()
      }
    })
    this.app.listen(3002, () => {
      //TODO: fix this hard coded port
    })
  }
}

class mockMediatorOutBoundTransporter implements OutboundTransporter {
  public constructor() {}
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

  public async stop(): Promise<void> {
    this.run = false
  }
  private async pollDownloadMessages(recipient:Agent, run = this.run) {
    if (run){
      const connection = await recipient.mediationRecipient.getDefaultMediatorConnection() 
      if (this.connection) {
        await recipient.mediationRecipient.downloadMessages(this.connection)
        await sleep(10000)
        await this.pollDownloadMessages(recipient)
      }
    }
  }
}
