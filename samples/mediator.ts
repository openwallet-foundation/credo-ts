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
 *
 * Mediation 2.0 + Pickup 3.0: Set MEDIATION_V2=true to enable. For v2,
 * clients must use v2 OOB invitations (didCommVersion: 'v2').
 */

import { AskarModule } from '@credo-ts/askar'
import type { InitConfig } from '@credo-ts/core'
import { Agent, LogLevel } from '@credo-ts/core'
import {
  DidCommConnectionInvitationMessage,
  DidCommHttpOutboundTransport,
  DidCommModule,
  DidCommWsOutboundTransport,
} from '@credo-ts/didcomm'
import { agentDependencies, DidCommHttpInboundTransport, DidCommWsInboundTransport } from '@credo-ts/node'
import { askar } from '@openwallet-foundation/askar-nodejs'
import express from 'express'
import type { Socket } from 'net'
import { WebSocketServer } from 'ws'
import { TestLogger } from '../packages/core/tests/logger'

const port = process.env.AGENT_PORT ? Number(process.env.AGENT_PORT) : 3001

// We create our own instance of express here. This is not required
// but allows use to use the same server (and port) for both WebSockets and HTTP
const app = express()
const socketServer = new WebSocketServer({ noServer: true })

const endpoints = process.env.AGENT_ENDPOINTS?.split(',') ?? [`http://localhost:${port}`, `ws://localhost:${port}`]
const wsEndpoint = endpoints.find((e) => e.startsWith('ws://')) ?? `ws://localhost:${port}`
const enableMediationV2 = process.env.MEDIATION_V2 === 'true'

// For Mediation 2.0, mediator needs a routing DID (did:peer:2 with service endpoint).
// Use MEDIATOR_ROUTING_DID to override. Default for ws://localhost:3001:
const DEFAULT_V2_ROUTING_DID =
  'did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc.SeyJ0IjoiZG0iLCJzIjoid3M6Ly9sb2NhbGhvc3Q6MzAwMSIsInIiOltdLCJhIjoibm9uZSMxIn0'
const mediatorRoutingDid =
  process.env.MEDIATOR_ROUTING_DID ?? (enableMediationV2 ? DEFAULT_V2_ROUTING_DID : undefined)

const logger = new TestLogger(LogLevel.Info)

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
      didcommVersions: enableMediationV2 ? ['v1', 'v2'] : ['v1'],
      transports: {
        inbound: [httpInboundTransport, wsInboundTransport],
        outbound: [httpOutboundTransport, wsOutboundTransport],
      },
      mediator: {
        autoAcceptMediationRequests: true,
        ...(enableMediationV2 && mediatorRoutingDid
          ? {
              mediationProtocolVersions: ['v1', 'v2'] as const,
              mediatorRoutingDid,
            }
          : {}),
      },
      connections: {
        autoAcceptConnections: true,
      },
    }),
  },
})

// Create invitation: GET /invitation (v1) or GET /invitation?v2=1 (v2 OOB, when MEDIATION_V2=true)
httpInboundTransport.app.get('/invitation', async (req, res) => {
  if (typeof req.query.c_i === 'string') {
    const invitation = DidCommConnectionInvitationMessage.fromUrl(req.url)
    res.send(invitation.toJSON())
  } else {
    const useV2 = req.query.v2 === '1' && enableMediationV2
    const { outOfBandInvitation } = await agent.didcomm.oob.createInvitation(
      useV2 ? { didCommVersion: 'v2' } : undefined
    )
    const httpEndpoint = endpoints.find((e) => e.startsWith('http'))
    const url = outOfBandInvitation.toUrl({ domain: `${httpEndpoint}/invitation` })
    res.send(useV2 ? { url, v2: true } : url)
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
