import type { Socket } from 'net'
import type { DummyStateChangedEvent } from './dummy'

import { AskarModule } from '@credo-ts/askar'
import { Agent, ConsoleLogger, LogLevel } from '@credo-ts/core'
import { DidCommModule } from '@credo-ts/didcomm'
import { DidCommHttpInboundTransport, DidCommWsInboundTransport, agentDependencies } from '@credo-ts/node'
import { askar } from '@openwallet-foundation/askar-nodejs'
import express from 'express'
import { WebSocketServer } from 'ws'

import { DummyEventTypes, DummyModule, DummyState } from './dummy'

const run = async () => {
  // Create transports
  const port = process.env.RESPONDER_PORT ? Number(process.env.RESPONDER_PORT) : 3002
  const autoAcceptRequests = true
  const app = express()
  const socketServer = new WebSocketServer({ noServer: true })

  const httpInboundTransport = new DidCommHttpInboundTransport({ app, port })
  const wsInboundTransport = new DidCommWsInboundTransport({ server: socketServer })

  // Setup the agent
  const agent = new Agent({
    config: {
      logger: new ConsoleLogger(LogLevel.debug),
    },
    modules: {
      askar: new AskarModule({
        askar,
        store: {
          id: 'responder',
          key: 'responder',
        },
      }),
      didcomm: new DidCommModule({
        endpoints: [`http://localhost:${port}`],
        connections: { autoAcceptConnections: true },
      }),
      dummy: new DummyModule({ autoAcceptRequests }),
    },
    dependencies: agentDependencies,
  })

  // Register transports
  agent.didcomm.registerInboundTransport(httpInboundTransport)
  agent.didcomm.registerInboundTransport(wsInboundTransport)

  // Allow to create invitation, no other way to ask for invitation yet
  app.get('/invitation', async (_req, res) => {
    const { outOfBandInvitation } = await agent.didcomm.oob.createInvitation()
    res.send(outOfBandInvitation.toUrl({ domain: `http://localhost:${port}/invitation` }))
  })

  // Now agent will handle messages and events from Dummy protocol

  //Initialize the agent
  await agent.initialize()

  httpInboundTransport.server?.on('upgrade', (request, socket, head) => {
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
