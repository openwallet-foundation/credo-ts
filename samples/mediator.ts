/**
 * This file contains a sample mediator. The mediator supports both
 * HTTP and WebSockets for communication and will automatically accept
 * incoming mediation requests.
 *
 * You can get an invitation by going to '/invitation', which by default is
 * http://localhost:3001/invitation
 *
 * To connect to the mediator from another agent, you can set the
 * 'mediatorConnectionsInvite' parameter in the agent config to the
 * url that is returned by the '/invitation/ endpoint. This will connect
 * to the mediator, request mediation and set the mediator as default.
 */

import { createServer } from 'node:http'
import { AskarModule } from '@credo-ts/askar'
import type { InitConfig } from '@credo-ts/core'
import { Agent, LogLevel } from '@credo-ts/core'
import { expressHost } from '@credo-ts/core/http/express'
import { DidCommModule } from '@credo-ts/didcomm'
import { agentDependencies } from '@credo-ts/node'
import { NativeAskar } from '@openwallet-foundation/askar-nodejs'
import express from 'express'
import { TestLogger } from '../packages/core/tests/logger'

const port = process.env.AGENT_PORT ? Number(process.env.AGENT_PORT) : 3001

// Our own express app and server, which also host the agent's HTTP and WebSocket endpoints
const app = express()
const server = createServer(app)

const endpoints = process.env.AGENT_ENDPOINTS?.split(',') ?? [`http://localhost:${port}`, `ws://localhost:${port}`]

const logger = new TestLogger(LogLevel.Info)

const agentConfig: InitConfig = {
  logger,
}

// Set up agent
const agent = new Agent({
  config: agentConfig,
  dependencies: agentDependencies,
  http: expressHost(app, { server }),
  modules: {
    askar: new AskarModule({
      askar: NativeAskar,
      store: {
        id: process.env.WALLET_NAME || 'Credo',
        key: process.env.WALLET_KEY || 'Credo',
      },
    }),
    didcomm: new DidCommModule({
      endpoints,
      transports: {
        inbound: { http: true, ws: true },
        outbound: { http: true, ws: true },
      },
      mediator: {
        autoAcceptMediationRequests: true,
      },
      connections: {
        autoAcceptConnections: true,
      },
    }),
  },
})

await agent.initialize()

// Allow to create invitation, no other way to ask for invitation yet
app.get('/invitation', async (_req, res) => {
  const { outOfBandInvitation } = await agent.didcomm.oob.createInvitation()
  const httpEndpoint = endpoints.find((e) => e.startsWith('http'))
  res.send(outOfBandInvitation.toUrl({ domain: `${httpEndpoint}/invitation` }))
})

server.listen(port)
