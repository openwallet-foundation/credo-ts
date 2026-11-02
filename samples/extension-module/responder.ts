import { createServer } from 'node:http'
import { AskarModule } from '@credo-ts/askar'
import { Agent, ConsoleLogger, LogLevel } from '@credo-ts/core'
import { expressHost } from '@credo-ts/core/http/express'
import { DidCommModule } from '@credo-ts/didcomm'
import { agentDependencies } from '@credo-ts/node'
import { NativeAskar } from '@openwallet-foundation/askar-nodejs'
import express from 'express'
import type { DummyStateChangedEvent } from './dummy'

import { DummyEventTypes, DummyModule, DummyState } from './dummy'

const run = async () => {
  // Create transports
  const port = process.env.RESPONDER_PORT ? Number(process.env.RESPONDER_PORT) : 3002
  const autoAcceptRequests = true
  const app = express()
  const server = createServer(app)

  // Setup the agent
  const agent = new Agent({
    config: {
      logger: new ConsoleLogger(LogLevel.Debug),
    },
    http: expressHost(app, { server }),
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
          inbound: { http: true, ws: true },
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

  server.listen(port)

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
