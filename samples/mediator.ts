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

import type { Socket } from 'net'
import type { InitConfig } from '@credo-ts/core'

import { askar } from '@openwallet-foundation/askar-nodejs'
import express from 'express'
import { WebSocketServer } from 'ws'

import { TestLogger } from '../packages/core/tests/logger'

import { AskarModule } from '@credo-ts/askar'
import { Agent, LogLevel } from '@credo-ts/core'
import {
  DidCommConnectionInvitationMessage,
  DidCommHttpOutboundTransport,
  DidCommModule,
  DidCommWsOutboundTransport,
} from '@credo-ts/didcomm'
import { DidCommHttpInboundTransport, DidCommWsInboundTransport, agentDependencies } from '@credo-ts/node'

const port = process.env.AGENT_PORT ? Number(process.env.AGENT_PORT) : 3001

// We create our own instance of express here. This is not required
// but allows use to use the same server (and port) for both WebSockets and HTTP
const app = express()
const socketServer = new WebSocketServer({ noServer: true })

const endpoints = process.env.AGENT_ENDPOINTS?.split(',') ?? [`http://localhost:${port}`, `ws://localhost:${port}`]

const logger = new TestLogger(LogLevel.info)

const agentConfig: InitConfig = {
  logger,
}

// Create all transports
const httpInboundTransport = new DidCommHttpInboundTransport({ app, port })
const httpOutboundTransport = new DidCommHttpOutboundTransport()
const wsInboundTransport = new DidCommWsInboundTransport({ server: socketServer })
const wsOutboundTransport = new DidCommWsOutboundTransport()

// Set up agent
const agent = new Agent({
  config: agentConfig,
  dependencies: agentDependencies,
  modules: {
    askar: new AskarModule({
      askar,
      store: {
        id: process.env.WALLET_NAME || 'Credo',
        key: process.env.WALLET_KEY || 'Credo',
      },
    }),
    didcomm: new DidCommModule({
      endpoints,
      transports: {
        inbound: [httpInboundTransport, wsInboundTransport],
        outbound: [httpOutboundTransport, wsOutboundTransport],
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

// Allow to create invitation, no other way to ask for invitation yet
httpInboundTransport.app.get('/invitation', async (req, res) => {
  if (typeof req.query.c_i === 'string') {
    const invitation = DidCommConnectionInvitationMessage.fromUrl(req.url)
    res.send(invitation.toJSON())
  } else {
    const { outOfBandInvitation } = await agent.didcomm.oob.createInvitation()
    const httpEndpoint = endpoints.find((e) => e.startsWith('http'))
    res.send(outOfBandInvitation.toUrl({ domain: `${httpEndpoint}/invitation` }))
  }
})

await agent.initialize()

// When an 'upgrade' to WS is made on our http server, we forward the
// request to the WS server
httpInboundTransport.server?.on('upgrade', (request, socket, head) => {
  socketServer.handleUpgrade(request, socket as Socket, head, (socket) => {
    socketServer.emit('connection', socket, request)
  })
})
