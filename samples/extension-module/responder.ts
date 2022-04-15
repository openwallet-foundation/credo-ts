import type { DummyStateChangedEvent } from './dummy'
import type { Socket } from 'net'

import { Agent, ConsoleLogger, LogLevel, WsOutboundTransport } from '@aries-framework/core'
import { agentDependencies, HttpInboundTransport, WsInboundTransport } from '@aries-framework/node'
import express from 'express'
import { Server } from 'ws'

import { DummyEventTypes, DummyModule, DummyState } from './dummy'

const run = async () => {
  // Create transports
  const port = process.env.RESPONDER_PORT ? Number(process.env.RESPONDER_PORT) : 3002
  const app = express()
  const socketServer = new Server({ noServer: true })

  const httpInboundTransport = new HttpInboundTransport({ app, port })
  const wsInboundTransport = new WsInboundTransport({ server: socketServer })
  const wsOutboundTransport = new WsOutboundTransport()

  // Setup the agent
  const agent = new Agent(
    {
      label: 'Dummy-powered agent - responder',
      endpoints: [`ws://localhost:${port}`],
      walletConfig: {
        id: 'responder',
        key: 'responder',
      },
      logger: new ConsoleLogger(LogLevel.test),
      autoAcceptConnections: true,
    },
    agentDependencies
  )

  // Register transports
  agent.registerInboundTransport(httpInboundTransport)
  agent.registerInboundTransport(wsInboundTransport)
  agent.registerInboundTransport(wsOutboundTransport)

  // Allow to create invitation, no other way to ask for invitation yet
  app.get('/invitation', async (req, res) => {
    const { outOfBandMessage } = await agent.oob.createInvitation()
    res.send(outOfBandMessage.toUrl({ domain: `http://localhost:${port}/invitation` }))
  })

  // Inject DummyModule
  const dummyModule = agent.injectionContainer.resolve(DummyModule)

  // Now agent will handle messages and events from Dummy protocol

  //Initialize the agent
  await agent.initialize()

  httpInboundTransport.server?.on('upgrade', (request, socket, head) => {
    socketServer.handleUpgrade(request, socket as Socket, head, (socket) => {
      socketServer.emit('connection', socket, request)
    })
  })

  // Subscribe to dummy record events
  agent.events.on(DummyEventTypes.StateChanged, async (event: DummyStateChangedEvent) => {
    if (event.payload.dummyRecord.state === DummyState.RequestReceived) {
      await dummyModule.respond(event.payload.dummyRecord)
    }
  })

  agent.config.logger.info(`Responder listening to port ${port}`)
}

void run()
