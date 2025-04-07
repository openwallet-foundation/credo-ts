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
import { Server } from 'ws'

import { TestLogger } from '../packages/core/tests/logger'

import { AskarModule } from '@credo-ts/askar'
import { Agent, LogLevel } from '@credo-ts/core'
import {
  ConnectionInvitationMessage,
  ConnectionsModule,
  DidCommModule,
  HttpOutboundTransport,
  MediatorModule,
  MessagePickupModule,
  OutOfBandModule,
  WsOutboundTransport,
} from '@credo-ts/didcomm'
import { HttpInboundTransport, WsInboundTransport, agentDependencies } from '@credo-ts/node'

const port = process.env.AGENT_PORT ? Number(process.env.AGENT_PORT) : 3001

// We create our own instance of express here. This is not required
// but allows use to use the same server (and port) for both WebSockets and HTTP
const app = express()
const socketServer = new Server({ noServer: true })

const endpoints = process.env.AGENT_ENDPOINTS?.split(',') ?? [`http://localhost:${port}`, `ws://localhost:${port}`]

const logger = new TestLogger(LogLevel.info)

const agentConfig: InitConfig = {
  label: process.env.AGENT_LABEL || 'Credo Mediator',
  walletConfig: {
    id: process.env.WALLET_NAME || 'Credo',
    key: process.env.WALLET_KEY || 'Credo',
  },
  logger,
}

// Set up agent
const agent = new Agent({
  config: agentConfig,
  dependencies: agentDependencies,
  modules: {
    askar: new AskarModule({ askar }),
    didcomm: new DidCommModule({ endpoints }),
    oob: new OutOfBandModule(),
    messagePickup: new MessagePickupModule(),
    mediator: new MediatorModule({
      autoAcceptMediationRequests: true,
    }),
    connections: new ConnectionsModule({
      autoAcceptConnections: true,
    }),
  },
})

// Create all transports
const httpInboundTransport = new HttpInboundTransport({ app, port })
const httpOutboundTransport = new HttpOutboundTransport()
const wsInboundTransport = new WsInboundTransport({ server: socketServer })
const wsOutboundTransport = new WsOutboundTransport()

// Register all Transports
agent.modules.didcomm.registerInboundTransport(httpInboundTransport)
agent.modules.didcomm.registerOutboundTransport(httpOutboundTransport)
agent.modules.didcomm.registerInboundTransport(wsInboundTransport)
agent.modules.didcomm.registerOutboundTransport(wsOutboundTransport)

// Allow to create invitation, no other way to ask for invitation yet
httpInboundTransport.app.get('/invitation', async (req, res) => {
  if (typeof req.query.c_i === 'string') {
    const invitation = ConnectionInvitationMessage.fromUrl(req.url)
    res.send(invitation.toJSON())
  } else {
    const { outOfBandInvitation } = await agent.modules.oob.createInvitation()
    const httpEndpoint = endpoints.find((e) => e.startsWith('http'))
    res.send(outOfBandInvitation.toUrl({ domain: `${httpEndpoint}/invitation` }))
  }
})

const run = async () => {
  await agent.initialize()

  // When an 'upgrade' to WS is made on our http server, we forward the
  // request to the WS server
  httpInboundTransport.server?.on('upgrade', (request, socket, head) => {
    socketServer.handleUpgrade(request, socket as Socket, head, (socket) => {
      socketServer.emit('connection', socket, request)
    })
  })
}

void run()
