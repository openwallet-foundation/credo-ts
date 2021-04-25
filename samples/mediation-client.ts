import express, { Express } from 'express'
import fetch from 'node-fetch'
import cors from 'cors'
import {
  Agent,
  InboundTransporter,
  OutboundTransporter,
  OutboundPackage,
  InitConfig,
  ConnectionEventType,
  ConnectionStateChangedEvent,
  LogLevel,
  ConnectionState,
  BasicMessageEventType,
  BasicMessageReceivedEvent,
  ConnectionRecord,
} from '../src'
import testLogger, { TestLogger } from '../src/__tests__/logger'
import indy from 'indy-sdk'
import { resolve } from 'path'
import { MediationEventType, MediationStateChangedEvent } from '../src/modules/routing/services/MediationService'
import { MediationState } from '../src/modules/routing/models/MediationState'
import { sleep } from '../src/__tests__/helpers'
import { InMemoryMessageRepository } from '../src/storage/InMemoryMessageRepository'

class HttpInboundTransporter implements InboundTransporter {
  private app: Express
  public stop: boolean

  public constructor(app: Express) {
    this.app = app
    this.stop = false
  }

  public async start(agent: Agent, mediatorConnection?: ConnectionRecord) {
    this.app.post('/msg', async (req, res) => {
      const message = req.body
      const packedMessage = JSON.parse(message)

      testLogger.debug('Received message: ' + JSON.stringify(packedMessage))
      try {
        const outboundMessage = await agent.receiveMessage(packedMessage)
        if (outboundMessage) {
          res.status(200).json(outboundMessage.payload).end()
        } else {
          res.status(200).end()
        }
      } catch (e) {
        testLogger.debug('Error: ' + e)
        res.status(200).end()
      }
    })

    this.stop = false

    if (mediatorConnection) {
      this.pollDownloadMessages(agent, mediatorConnection)
    }
  }

  private pollDownloadMessages(agent: Agent, mediatorConnection: ConnectionRecord) {
    const loop = async () => {
      while (!this.stop) {
        await agent.routing.downloadMessages(mediatorConnection)
        await sleep(5000)
      }
    }
    new Promise(() => {
      loop()
    })
  }
}

class HttpOutboundTransporter implements OutboundTransporter {
  private agent: Agent
  private messageRepository?: InMemoryMessageRepository

  public constructor(agent: Agent, messageRepository?: InMemoryMessageRepository) {
    this.agent = agent
    this.messageRepository = messageRepository
  }

  public async sendMessage(outboundPackage: OutboundPackage, receiveReply: boolean) {
    const { connection, payload, endpoint } = outboundPackage

    if (!endpoint) {
      throw new Error(`Missing endpoint. I don't know how and where to send the message.`)
    }

    try {
      if (endpoint == 'didcomm:transport/queue' && this.messageRepository) {
        testLogger.debug('Storing message for queue: ', { connection, payload })
        this.messageRepository.save(connection.theirKey!, payload)
        return
      }

      if (receiveReply) {
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
      } else {
        const rsp = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/ssi-agent-wire',
          },
          body: JSON.stringify(payload),
        })
        testLogger.debug('rsp status: ' + rsp.status)
      }
    } catch (e) {
      testLogger.debug('error sending message', e)
      throw e
    }
  }
}

const agentConfig: InitConfig = {
  host: process.env.AGENT_HOST,
  port: process.env.AGENT_PORT || 3001,
  poolName: 'local-js',
  genesisPath: resolve(process.env.GENESIS_TXN_PATH!),
  endpoint: process.env.AGENT_ENDPOINT,
  label: process.env.AGENT_LABEL || '',
  walletConfig: { id: process.env.WALLET_NAME || '' },
  walletCredentials: { key: process.env.WALLET_KEY || '' },
  publicDid: process.env.PUBLIC_DID || '',
  publicDidSeed: process.env.PUBLIC_DID_SEED || '',
  mediatorRecordId: process.env.MEDIATOR_RECORD_ID || '',
  autoAcceptConnections: true,
  logger: new TestLogger(LogLevel.debug),
  indy: indy,
}

const PORT = Number(agentConfig.port)
const app = express()

app.use(cors())
app.use(express.json())
app.use(
  express.text({
    type: ['application/ssi-agent-wire', 'text/plain'],
  })
)
app.set('json spaces', 2)

const agent = new Agent(agentConfig)

const messageSender = new HttpOutboundTransporter(agent)
const messageReceiver = new HttpInboundTransporter(app)

agent.setInboundTransporter(messageReceiver)
agent.setOutboundTransporter(messageSender)

agent.connections.events.on(ConnectionEventType.StateChanged, async (event: ConnectionStateChangedEvent) => {
  testLogger.info('Connection state changed for ' + event.connectionRecord.id)
  testLogger.debug('Previous state: ' + event.previousState + ' New state: ' + event.connectionRecord.state)

  if (event.connectionRecord.alias == 'mediator' && event.connectionRecord.state == ConnectionState.Complete) {
    testLogger.info('Mediator connection completed. Requesting mediation...')

    await agent.routing.requestMediation(event.connectionRecord)

    // Start polling responses from this connection
    messageReceiver.stop = true
    messageReceiver.start(agent, event.connectionRecord)

    // Request mediation
    testLogger.info('Mediation Request sent')
  }
})

agent.routing.mediationEvents.on(MediationEventType.StateChanged, async (event: MediationStateChangedEvent) => {
  testLogger.info('Mediation state changed for ' + event.mediationRecord.id)
  testLogger.debug('Previous state: ' + event.previousState + ' New state: ' + event.mediationRecord.state)

  if (event.mediationRecord.state == MediationState.Granted) {
    const connectionRecord = await agent.connections.getById(event.mediationRecord.connectionId)
    if (connectionRecord) {
      agent.setInboundConnection({
        connection: connectionRecord,
        verkey: event.mediationRecord.routingKeys[0],
      })
    }
  }
})

agent.basicMessages.events.on(BasicMessageEventType.MessageReceived, async (event: BasicMessageReceivedEvent) => {
  testLogger.info('Message received: ' + event.message.content)
})

app.post('/basic-message', async (req, res) => {
  try {
    const connectionId = req.body.connection_id
    const message = req.body.message

    if (!connectionId || !message) {
      throw new Error('Missing parameter in body. Format: {"connection_id": ..., "content": ... }')
    }

    const connectionRecord = await agent.connections.getById(connectionId)
    if (connectionRecord) {
      const result = await agent.basicMessages.sendMessage(connectionRecord, message)
      res.send(result)
    } else {
      throw Error('Connection not found')
    }
  } catch (e) {
    res.status(500)
    testLogger.debug('Error: ' + e)
    res.send('Error: ' + e)
  }
})

// Create new invitation as inviter to invitee
app.get('/invitation', async (req, res) => {
  const { invitation } = await agent.connections.createConnection()
  res.send(invitation.toJSON())
})

// Receive invitation and assign an alias
app.post('/receive-invitation', async (req, res) => {
  try {
    const invitation = req.body.invitation
    const alias = req.body.alias

    if (!alias || !invitation) {
      throw new Error('Missing parameter in body. Format: {"alias": ..., "invitation": ... }')
    }

    const result = await agent.connections.receiveInvitation(invitation, { autoAcceptConnection: true, alias: alias })

    res.send(result)
  } catch (e) {
    res.status(500)
    testLogger.debug('Error: ' + e)
    res.send('Error: ' + e)
  }
})

app.get('/connections', async (req, res) => {
  const connections = await agent.connections.getAll()
  res.json(connections)
})

app.get('/credentials', async (req, res) => {
  const credentials = await agent.credentials.getAll()
  res.json(credentials)
})

app.get('/register-mediator', async (req, res) => {
  const response = await fetch(process.env.MEDIATOR_INVITATION_ENDPOINT || 'http://localhost:3000/invitation', {
    method: 'GET',
  })

  const data = await response.text()
  const invitation = JSON.parse(data)
  testLogger.info(data)

  try {
    const alias = 'mediator'

    if (!alias || !invitation) {
      throw new Error('Missing parameter')
    }

    const result = await agent.connections.receiveInvitation(invitation, { autoAcceptConnection: true, alias: alias })

    res.send(result)
  } catch (e) {
    res.status(500)
    testLogger.debug('Error: ' + e)
    res.send('Error: ' + e)
  }
})

app.listen(PORT, '0.0.0.0', 0, async () => {
  await agent.init()
  messageReceiver.start(agent, agent.routing.getInboundConnection()?.connection)
  testLogger.debug(`JavaScript Edge Agent started on port ${PORT}`)
})
