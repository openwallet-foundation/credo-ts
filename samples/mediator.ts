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

import type { InitConfig } from '@aries-framework/core'
import type { Socket } from 'net'

import express from 'express'
import { Server } from 'ws'

import { TestLogger } from '../packages/core/tests/logger'

import {
  HttpOutboundTransport,
  Agent,
  ConnectionInvitationMessage,
  LogLevel,
  AgentConfig,
  WsOutboundTransport,
} from '@aries-framework/core'
import { HttpInboundTransport, agentDependencies, WsInboundTransport } from '@aries-framework/node'

const port = process.env.AGENT_PORT ? Number(process.env.AGENT_PORT) : 3001

// We create our own instance of express here. This is not required
// but allows use to use the same server (and port) for both WebSockets and HTTP
const app = express()
const socketServer = new Server({ noServer: true })

const endpoints = process.env.AGENT_ENDPOINTS?.split(',') ?? [`http://localhost:${port}`, `ws://localhost:${port}`]

const logger = new TestLogger(LogLevel.info)

const agentConfig: InitConfig = {
  endpoints,
  label: process.env.AGENT_LABEL || 'Aries Framework JavaScript Mediator',
  walletConfig: {
    id: process.env.WALLET_NAME || 'AriesFrameworkJavaScript',
    key: process.env.WALLET_KEY || 'AriesFrameworkJavaScript',
  },
  autoAcceptConnections: true,
  autoAcceptMediationRequests: true,
  logger,
}

// Set up agent
const agent = new Agent(agentConfig, agentDependencies)
const config = agent.injectionContainer.resolve(AgentConfig)

// Create all transports
const httpInboundTransport = new HttpInboundTransport({ app, port })
const httpOutboundTransport = new HttpOutboundTransport()
const wsInboundTransport = new WsInboundTransport({ server: socketServer })
const wsOutboundTransport = new WsOutboundTransport()

// Register all Transports
agent.registerInboundTransport(httpInboundTransport)
agent.registerOutboundTransport(httpOutboundTransport)
agent.registerInboundTransport(wsInboundTransport)
agent.registerOutboundTransport(wsOutboundTransport)

// Allow to create invitation, no other way to ask for invitation yet
httpInboundTransport.app.get('/invitation', async (req, res) => {
  if (typeof req.query.c_i === 'string') {
    const invitation = await ConnectionInvitationMessage.fromUrl(req.url)
    res.send(invitation.toJSON())
  } else {
    const { invitation } = await agent.connections.createConnection()

    const httpEndpoint = config.endpoints.find((e) => e.startsWith('http'))
    res.send(invitation.toUrl({ domain: httpEndpoint + '/invitation' }))
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

run()
