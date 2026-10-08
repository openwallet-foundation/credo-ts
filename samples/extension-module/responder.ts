import { AskarModule } from '@credo-ts/askar'
import { Agent, ConsoleLogger, LogLevel } from '@credo-ts/core'
import { DidCommHttpInboundTransport, DidCommModule, DidCommWsInboundTransport } from '@credo-ts/didcomm'
import { agentDependencies, httpServerHost, webSocketHost } from '@credo-ts/node'
import { NativeAskar } from '@openwallet-foundation/askar-nodejs'
import type { Socket } from 'net'
import { WebSocketServer } from 'ws'
import type { DummyStateChangedEvent } from './dummy'

import { DummyEventTypes, DummyModule, DummyState } from './dummy'

const run = async () => {
  // Create transports
  const port = process.env.RESPONDER_PORT ? Number(process.env.RESPONDER_PORT) : 3002
  const autoAcceptRequests = true
  const socketServer = new WebSocketServer({ noServer: true })
  const httpHost = httpServerHost({ port })
  const app = httpHost.app

  // Setup the agent
  const agent = new Agent({
    config: {
      logger: new ConsoleLogger(LogLevel.Debug),
    },
    modules: {
      askar: new AskarModule({
        askar: NativeAskar,
        store: {
          id: 'responder',
          key: 'responder',
        },
      }),
      didcomm: new DidCommModule({
        endpoints: [`http://localhost:${port}`],
        transports: {
          inbound: [
            new DidCommHttpInboundTransport({ host: httpHost }),
            new DidCommWsInboundTransport({ host: webSocketHost({ server: socketServer }) }),
          ],
        },
        connections: { autoAcceptConnections: true },
      }),
      dummy: new DummyModule({ autoAcceptRequests }),
    },
    dependencies: agentDependencies,
  })

  // Allow to create invitation, no other way to ask for invitation yet
  app.get('/invitation', async (_req, res) => {
    const { outOfBandInvitation } = await agent.didcomm.oob.createInvitation()
    res.send(outOfBandInvitation.toUrl({ domain: `http://localhost:${port}/invitation` }))
  })

  // Now agent will handle messages and events from Dummy protocol

  //Initialize the agent
  await agent.initialize()

  httpHost.server?.on('upgrade', (request, socket, head) => {
    socketServer.handleUpgrade(request, socket as Socket, head, (socket) => {
      socketServer.emit('connection', socket, request)
    })
  })

  // If autoAcceptRequests is enabled, the handler will automatically respond
  // (no need to subscribe to event and manually accept)
  if (!autoAcceptRequests) {
    agent.events.on(DummyEventTypes.StateChanged, async (event: DummyStateChangedEvent) => {
      if (event.payload.dummyRecord.state === DummyState.RequestReceived) {
        await agent.modules.dummy.respond(event.payload.dummyRecord.id)
      }
    })
  }

  agent.config.logger.info(`Responder listening to port ${port}`)
}

void run()
