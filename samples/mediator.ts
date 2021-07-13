import indy from 'indy-sdk'

import { HttpOutboundTransporter, Agent, ConnectionInvitationMessage, LogLevel } from '../src'
import { TestLogger } from '../src/__tests__/logger'
import { AgentConfig } from '../src/agent/AgentConfig'
import { NodeFileSystem } from '../src/storage/fs/NodeFileSystem'
import { HttpInboundTransporter } from '../tests/transport/HttpInboundTransport'

const agentConfig = {
  host: process.env.AGENT_HOST || 'http://localhost',
  port: process.env.AGENT_PORT || 3001,
  endpoint: process.env.AGENT_ENDPOINT || undefined,
  label: process.env.AGENT_LABEL || 'Aries Framework JavaScript Mediator',
  walletConfig: { id: process.env.WALLET_NAME || 'AriesFrameworkJavaScript' },
  walletCredentials: { key: process.env.WALLET_KEY || 'AriesFrameworkJavaScript' },
  publicDidSeed: process.env.PUBLIC_DID_SEED || '000000000000000000HTTPMediator02',
  autoAcceptConnections: true,
  autoAcceptMediationRequests: true,
  logger: new TestLogger(LogLevel.debug),
  indy,
  fileSystem: new NodeFileSystem(),
}

// Set up agent
const agent = new Agent(agentConfig)
const config = agent.injectionContainer.resolve(AgentConfig)
const inboundTransporter = new HttpInboundTransporter()
const outboundTransporter = new HttpOutboundTransporter()

agent.setInboundTransporter(inboundTransporter)
agent.setOutboundTransporter(outboundTransporter)

// Allow to create invitation, no other way to ask for invitation yet
inboundTransporter.app.get('/invitation', async (req, res) => {
  if (typeof req.query.c_i === 'string') {
    const invitation = await ConnectionInvitationMessage.fromUrl(req.url)
    res.send(invitation.toJSON())
  } else {
    const { invitation } = await agent.connections.createConnection()

    res.send(invitation.toUrl(config.getEndpoint() + '/invitation'))
  }
})

const run = async () => {
  await agent.initialize()
}

run()
