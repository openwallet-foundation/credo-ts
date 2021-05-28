import express, { Express } from 'express'
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
import { getBaseConfig, sleep, waitForBasicMessage } from '../../src/__tests__/helpers'
import logger from '../../src/__tests__/logger'
import cors from 'cors'
import { InMemoryMessageRepository } from '../../src/storage/InMemoryMessageRepository'
import { MessageRepository } from '../../src/storage/MessageRepository'
import { ReturnRouteTypes } from '../../src/decorators/transport/TransportDecorator'
import { HttpOutboundTransporter } from '../mediation-server'

const recipientConfig = getBaseConfig('E2E recipient')
const mediatorConfig = getBaseConfig('E2E mediator', {
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

  //let recipientConfig: AgentConfig
  //let recipientWallet: Wallet

  beforeAll(async () => {
    //recipientConfig = new AgentConfig(recipientConfig)
    //recipientWallet = new IndyWallet(recipientConfig)
    //await recipientWallet.init()
  })
  afterAll(async () => {
    ;(recipientAgent.inboundTransporter as mockMobileInboundTransporter).stop = true
    
    // Wait for messages to flush out
    await new Promise((r) => setTimeout(r, 1000))
    
    await recipientAgent.closeAndDeleteWallet()
    await mediatorAgent.closeAndDeleteWallet()
  })


  test('recipient and mediator establish a connection and granted mediation', async () => {
    recipientAgent = new Agent(recipientConfig)
    recipientAgent.setOutboundTransporter(new mockMobileOutBoundTransporter(recipientAgent))
    await recipientAgent.init()

    mediatorAgent = new Agent(mediatorConfig, messageRepository)
    mediatorAgent.setInboundTransporter(new mockMediatorInBoundTransporter(app))
    await mediatorAgent.init()

    recipientAgent.setInboundTransporter(new mockMobileInboundTransporter(recipientAgent, mediatorAgent))
    
    recipientAgent.inboundTransporter?.start(recipientAgent)
    const recipientMediatorConnection = await recipientAgent.mediationRecipient.getDefaultMediatorConnection()
    expect(recipientMediatorConnection?.isReady)
    recipientMediatorRecord = await recipientAgent.mediationRecipient.getDefaultMediator()
    expect(recipientMediatorRecord?.state).toBe(MediationState.Granted)
  })

  test('recipient and Ted make a connection via mediator', async () => {
    // eslint-disable-next-line prefer-const
    tedAgent = new Agent(tedConfig)
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
    expect(recipientTedConnection).toBeConnectedWith(tedRecipientConnection)
  })

  test('Send a message from recipient to ted via mediator', async () => {
    // send message from recipient to ted
    const message = 'hello, world'
    await recipientAgent.basicMessages.sendMessage(tedRecipientConnection, message)

    const basicMessage = await waitForBasicMessage(mediatorAgent, {
      content: message,
    })

    expect(basicMessage.content).toBe(message)
  })
})

describe('websockets with mediator', () => {
  let recipientAgent: Agent
  let mediatorAgent: Agent

  afterAll(async () => {
    await recipientAgent.outboundTransporter?.stop()
    await mediatorAgent.outboundTransporter?.stop()

    // Wait for messages to flush out
    await new Promise((r) => setTimeout(r, 1000))

    await recipientAgent.closeAndDeleteWallet()
    await mediatorAgent.closeAndDeleteWallet()
  })

  test('recipient and Bob make a connection with mediator from config', async () => {
    recipientAgent = new Agent(recipientConfig)
    recipientAgent.setInboundTransporter(new WsInboundTransporter())
    recipientAgent.setOutboundTransporter(new WsOutboundTransporter(recipientAgent))
    await recipientAgent.init()

    mediatorAgent = new Agent(mediatorConfig)
    mediatorAgent.setInboundTransporter(new WsInboundTransporter())
    mediatorAgent.setOutboundTransporter(new WsOutboundTransporter(mediatorAgent))
    await mediatorAgent.init()
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
    if (!endpoint || endpoint == 'didcomm:transport/queue' ) {
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
  public stop: boolean
  public connection?: ConnectionRecord
  public recipient: Agent
  public mediator: Agent
  public constructor(recipient: Agent, mediator: Agent) {
    this.stop = true
    this.recipient = recipient
    this.mediator = mediator
  }
  public async start(agent: Agent) {
    await this.registerMediator(this.recipient, this.mediator)
    if (this.connection) {
      this.stop = false
      this.pollDownloadMessages(agent, this.connection)
    }
  }

  public async registerMediator(recipient: Agent, mediator: Agent) {
    let { invitation, connectionRecord } = await mediator.connections.createConnection({autoAcceptConnection: true})
    // invitation.setReturnRouting(ReturnRouteTypes.all)
    const recipientConnection = await recipient.connections.receiveInvitation(invitation)
    const mediatorAgentConnection = await mediator.connections.returnWhenIsConnected(connectionRecord.id)
    const recipientAgentConnection = await recipient.connections.returnWhenIsConnected(recipientConnection.id)
    const mediationRecord = await recipient.mediationRecipient.requestAndWaitForAcception(
      connectionRecord,
      undefined,
      2000
    )
    // expects should be a independent test, but this will do for now...
    expect(mediationRecord.state).toBe(MediationState.Granted)
    expect(recipientAgentConnection).toBeConnectedWith(mediatorAgentConnection)
    expect(mediatorAgentConnection).toBeConnectedWith(recipientAgentConnection)
    this.connection = recipientAgentConnection
    // this.pollDownloadMessages(recipient, recipientConnection)
  }

  private pollDownloadMessages(recipient: Agent, Connection: ConnectionRecord) {
    const loop = async () => {
      while (!this.stop) {
        await recipient.mediationRecipient.downloadMessages(Connection)
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

  private async registerMediator(agent: Agent) {}
}
