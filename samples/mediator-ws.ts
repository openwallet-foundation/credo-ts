import express from 'express'
import indy from 'indy-sdk'
import WebSocket from 'ws'

import { Agent, ConnectionInvitationMessage, LogLevel, WsOutboundTransporter } from '../src'
import { TestLogger } from '../src/__tests__/logger'
import { AgentConfig } from '../src/agent/AgentConfig'
import { NodeFileSystem } from '../src/storage/fs/NodeFileSystem'
import { WsInboundTransporter } from '../tests/transport/WsInboundTransport'

const agentConfig = {
  host: process.env.AGENT_HOST || 'ws://localhost',
  port: process.env.AGENT_PORT || 3002,
  endpoint: process.env.AGENT_ENDPOINT?.replace('http', 'ws'),
  label: process.env.AGENT_LABEL || 'Aries Framework JavaScript Mediator',
  walletConfig: { id: process.env.WALLET_NAME || 'AriesFrameworkJavaScript' },
  walletCredentials: { key: process.env.WALLET_KEY || 'AriesFrameworkJavaScript' },
  publicDidSeed: process.env.PUBLIC_DID_SEED || '00000000000000000000WSMediator02',
  autoAcceptConnections: true,
  autoAcceptMediationRequests: true,
  logger: new TestLogger(LogLevel.debug),
  indy,
  fileSystem: new NodeFileSystem(),
}

const app = express()
const socketServer = new WebSocket.Server({ noServer: true })

const agent = new Agent(agentConfig)
const config = agent.injectionContainer.resolve(AgentConfig)
const messageSender = new WsOutboundTransporter()
const messageReceiver = new WsInboundTransporter(socketServer)
agent.setInboundTransporter(messageReceiver)
agent.setOutboundTransporter(messageSender)

// Allow to create invitation, no other way to ask for invitation yet
app.get('/invitation', async (req, res) => {
  if (typeof req.query.c_i === 'string') {
    const invitation = await ConnectionInvitationMessage.fromUrl(req.url)
    res.send(invitation.toJSON())
  } else {
    const { invitation } = await agent.connections.createConnection()

    res.send(invitation.toUrl(config.getEndpoint() + '/invitation'))
  }
})

const server = app.listen(agentConfig.port, async () => {
  await agent.initialize()
})

server.on('upgrade', (request, socket, head) => {
  socketServer.handleUpgrade(request, socket, head, (socket) => {
    socketServer.emit('connection', socket, request)
  })
})
