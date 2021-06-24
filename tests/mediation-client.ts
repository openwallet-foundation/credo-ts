import type {
  InboundTransporter,
  OutboundTransporter,
  OutboundPackage,
  InitConfig,
  ConnectionStateChangedEvent,
  BasicMessageReceivedEvent,
  ConnectionRecord,
} from '../src'
import type { MediationStateChangedEvent } from '../src/modules/routing/RoutingEvents'
import type { InMemoryMessageRepository } from '../src/storage/InMemoryMessageRepository'
import type { Express } from 'express'

import cors from 'cors'
import express from 'express'
import indy from 'indy-sdk'
import fetch from 'node-fetch'
import { resolve } from 'path'

import { Agent, LogLevel, ConnectionState, BasicMessageEventTypes, ConnectionEventTypes, MediationState } from '../src'
import testLogger, { TestLogger } from '../src/__tests__/logger'
import { RoutingEventTypes } from '../src/modules/routing/RoutingEvents'
import { NodeFileSystem } from '../src/storage/fs/NodeFileSystem'

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
    setInterval(async () => {
      if (!this.stop) {
        await agent.mediationRecipient.downloadMessages(mediatorConnection)
      }
    }, 50)
  }
}

class HttpOutboundTransporter implements OutboundTransporter {
  private agent: Agent
  private messageRepository?: InMemoryMessageRepository

  public constructor(agent: Agent, messageRepository?: InMemoryMessageRepository) {
    this.agent = agent
    this.messageRepository = messageRepository
  }
  public supportedSchemes = []

  public async start(): Promise<void> {
    // No custom logic required for start
  }
  public async stop(): Promise<void> {
    // No custom logic required for stop
  }

  public async sendMessage(outboundPackage: OutboundPackage) {
    const { connection, payload, endpoint, responseRequested } = outboundPackage

    if (!endpoint) {
      throw new Error(`Missing endpoint. I don't know how and where to send the message.`)
    }

    try {
      if (endpoint == 'didcomm:transport/queue' && this.messageRepository) {
        testLogger.debug('Storing message for queue: ', { connection, payload })
        if (connection && connection.theirKey) {
          this.messageRepository.save(connection.theirKey, payload)
        }
        return
      }

      if (responseRequested) {
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
  genesisPath: resolve(process.env.GENESIS_TXN_PATH ?? '/Path/To/no-were'),
  endpoint: process.env.AGENT_ENDPOINT,
  label: process.env.AGENT_LABEL || '',
  walletConfig: { id: process.env.WALLET_NAME || '' },
  walletCredentials: { key: process.env.WALLET_KEY || '' },
  // publicDid: process.env.PUBLIC_DID || '',
  publicDidSeed: process.env.PUBLIC_DID_SEED || '',
  mediatorRecordId: process.env.MEDIATOR_RECORD_ID || '',
  autoAcceptConnections: true,
  logger: new TestLogger(LogLevel.debug),
  indy: indy,
  fileSystem: new NodeFileSystem(),
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

agent.events.on<ConnectionStateChangedEvent>(
  ConnectionEventTypes.ConnectionStateChanged,
  async (event: ConnectionStateChangedEvent) => {
    testLogger.info('Connection state changed for ' + event.payload.connectionRecord.id)
    testLogger.debug(
      'Previous state: ' + event.payload.previousState + ' New state: ' + event.payload.connectionRecord.state
    )

    if (
      event.payload.connectionRecord.alias == 'mediator' &&
      event.payload.connectionRecord.state == ConnectionState.Complete
    ) {
      testLogger.info('Mediator connection completed. Requesting mediation...')

      await agent.mediationRecipient.requestMediation(event.payload.connectionRecord)

      // Start polling responses from this connection
      messageReceiver.stop = true
      messageReceiver.start(agent, event.payload.connectionRecord)

      // Request mediation
      testLogger.info('Mediation Request sent')
    }
  }
)

agent.events.on<MediationStateChangedEvent>(
  RoutingEventTypes.MediationStateChanged,
  async (event: MediationStateChangedEvent) => {
    testLogger.info('Mediation state changed for ' + event.payload.mediationRecord.id)
    testLogger.debug(
      'Previous state: ' + event.payload.previousState + ' New state: ' + event.payload.mediationRecord.state
    )

    if (event.payload.mediationRecord.state == MediationState.Granted) {
      const connectionRecord = await agent.connections.getById(event.payload.mediationRecord.connectionId)
      if (connectionRecord) {
        /*agent.setInboundConnection({
        connection: connectionRecord,
        verkey: event.mediationRecord.routingKeys[0],
      })*/
      }
    }
  }
)

agent.events.on<BasicMessageReceivedEvent>(
  BasicMessageEventTypes.BasicMessageReceived,
  async (event: BasicMessageReceivedEvent) => {
    testLogger.info('Message received: ' + event.payload.message.content)
  }
)

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

function _assertConnection(connection: ConnectionRecord | undefined): ConnectionRecord {
  if (!connection) throw Error('')
  connection.assertReady()
  return connection
}
app.listen(PORT, '0.0.0.0', 0, async () => {
  await agent.init()
  let connection = await agent.mediationRecipient.getDefaultMediatorConnection()
  connection = _assertConnection(connection)
  messageReceiver.start(agent, connection)
  testLogger.debug(`JavaScript Edge Agent started on port ${PORT}`)
})
