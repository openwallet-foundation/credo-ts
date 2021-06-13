import type { MessageRepository } from '../packages/core/src/storage/MessageRepository'
import type { InboundTransporter, OutboundTransporter, OutboundPackage } from '@aries-framework/core'
import type { Express } from 'express'

import cors from 'cors'
import express, { text } from 'express'

import testLogger from '../packages/core/tests/logger'

import config, { dependencies } from './config'

import { DidCommMimeType, AriesFrameworkError, Agent, InMemoryMessageRepository } from '@aries-framework/core'

class HttpInboundTransporter implements InboundTransporter {
  private app: Express

  public constructor(app: Express) {
    this.app = app
  }

  public async start(agent: Agent) {
    this.app.post('/msg', async (req, res) => {
      const message = req.body
      const packedMessage = JSON.parse(message)
      const outboundMessage = await agent.receiveMessage(packedMessage)
      if (outboundMessage) {
        res.status(200).json(outboundMessage.payload).end()
      } else {
        res.status(200).end()
      }
    })
  }
}

class StorageOutboundTransporter implements OutboundTransporter {
  private messageRepository: MessageRepository

  public supportedSchemes = []

  public constructor(messageRepository: MessageRepository) {
    this.messageRepository = messageRepository
  }

  public async start(): Promise<void> {
    // Nothing required to start
  }

  public async stop(): Promise<void> {
    // Nothing required to stop
  }

  public async sendMessage(outboundPackage: OutboundPackage) {
    const { connection, payload } = outboundPackage

    if (!connection) {
      throw new AriesFrameworkError(`Missing connection. I don't know how and where to send the message.`)
    }

    if (!connection.theirKey) {
      throw new AriesFrameworkError('Trying to save message without theirKey!')
    }

    testLogger.debug('Storing message', { connection, payload })

    this.messageRepository.save(connection.theirKey, payload)
  }
}

const PORT = config.port
const app = express()

app.use(cors())
app.use(
  text({
    type: [DidCommMimeType.V0, DidCommMimeType.V1],
  })
)
app.set('json spaces', 2)

const messageRepository = new InMemoryMessageRepository()
const messageSender = new StorageOutboundTransporter(messageRepository)
const messageReceiver = new HttpInboundTransporter(app)
const agent = new Agent(config, dependencies, messageRepository)
agent.setInboundTransporter(messageReceiver)
agent.setOutboundTransporter(messageSender)

app.get('/', async (req, res) => {
  const agentDid = agent.publicDid
  res.send(agentDid)
})

// Create new invitation as inviter to invitee
app.get('/invitation', async (req, res) => {
  const { invitation } = await agent.connections.createConnection()

  res.send(invitation.toUrl())
})

app.get('/api/connections/:verkey', async (req, res) => {
  // TODO This endpoint is for testing purpose only. Return mediator connection by their verkey.
  const verkey = req.params.verkey
  const connection = await agent.connections.findByTheirKey(verkey)
  res.send(connection)
})

app.get('/api/connections', async (req, res) => {
  // TODO This endpoint is for testing purpose only. Return mediator connection by their verkey.
  const connections = await agent.connections.getAll()
  res.json(connections)
})

app.get('/api/routes', async (req, res) => {
  // TODO This endpoint is for testing purpose only. Return mediator connection by their verkey.
  const routes = agent.routing.getRoutingTable()
  res.send(routes)
})

app.listen(PORT, async () => {
  await agent.init()
  messageReceiver.start(agent)
  testLogger.info(`Application started on port ${PORT}`)
})
