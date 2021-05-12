import express from 'express'
import WebSocket from 'ws'
import cors from 'cors'
import { v4 as uuid } from 'uuid'
import config from './config'
import { Agent, InboundTransporter, OutboundTransporter } from '../src'
import { OutboundPackage, DidCommMimeType } from '../src/types'
import { InMemoryMessageRepository } from '../src/storage/InMemoryMessageRepository'
import { WebSocketTransport } from '../src/agent/TransportService'
import testLogger from '../src/__tests__/logger'

const logger = testLogger

class WsInboundTransporter implements InboundTransporter {
  private socketServer: WebSocket.Server

  // We're using a `socketId` just for the prevention of calling the connection handler twice.
  private socketIds: Record<string, unknown> = {}

  public constructor(socketServer: WebSocket.Server) {
    this.socketServer = socketServer
  }

  public async start(agent: Agent) {
    this.socketServer.on('connection', (socket: any, _: Express.Request, socketId: string) => {
      logger.debug('Socket connected.')

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

  private listenOnWebSocketMessages(agent: Agent, socket: WebSocket) {
    socket.addEventListener('message', async (event: any) => {
      logger.debug('WebSocket message event received.', { url: event.target.url, data: event.data })
      // @ts-expect-error Property 'dispatchEvent' is missing in type WebSocket imported from 'ws' module but required in type 'WebSocket'.
      const transport = new WebSocketTransport('', socket)
      const outboundMessage = await agent.receiveMessage(JSON.parse(event.data), transport)
      if (outboundMessage) {
        socket.send(JSON.stringify(outboundMessage.payload))
      }
    })
  }
}

class WsOutboundTransporter implements OutboundTransporter {
  public supportedSchemes = ['ws', 'wss']

  public async sendMessage(outboundPackage: OutboundPackage) {
    const { connection, payload, transport } = outboundPackage
    logger.debug(`Sending outbound message to connection ${connection.id} over ${transport?.type} transport.`, payload)

    if (transport instanceof WebSocketTransport) {
      if (transport.socket?.readyState === WebSocket.OPEN) {
        logger.debug('Sending message over existing inbound socket.')
        transport.socket.send(JSON.stringify(payload))
      } else {
        throw new Error('No socket connection.')
      }
    } else {
      throw new Error(`Unsupported transport ${transport?.type}.`)
    }
  }
}

const PORT = config.port
const app = express()

app.use(cors())
app.use(
  express.text({
    type: [DidCommMimeType.V0, DidCommMimeType.V1],
  })
)
app.set('json spaces', 2)

const socketServer = new WebSocket.Server({ noServer: true })
// TODO Remove when mediation protocol is implemented
// This endpoint is used in all invitations created by this mediator agent.
config.endpoint = `ws://localhost:${PORT}`

const messageRepository = new InMemoryMessageRepository()
const messageSender = new WsOutboundTransporter()
const messageReceiver = new WsInboundTransporter(socketServer)
const agent = new Agent(config, messageRepository)
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
  const connection = await agent.connections.findConnectionByTheirKey(verkey)
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

app.get('/api/messages', async (req, res) => {
  // TODO This endpoint is for testing purpose only.
  // res.send(messageSender.messages)
})

const server = app.listen(PORT, async () => {
  await agent.init()
  messageReceiver.start(agent)
  logger.info(`WebSockets application started on port ${PORT}`)
})

server.on('upgrade', (request, socket, head) => {
  socketServer.handleUpgrade(request, socket, head, (socketParam) => {
    const socketId = uuid()
    socketServer.emit('connection', socketParam, request, socketId)
  })
})
