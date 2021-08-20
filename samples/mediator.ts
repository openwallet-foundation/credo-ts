import { TestLogger } from '../packages/core/tests/logger'

import { HttpOutboundTransport, Agent, ConnectionInvitationMessage, LogLevel, AgentConfig } from '@aries-framework/core'
import { HttpInboundTransport, agentDependencies } from '@aries-framework/node'

const port = process.env.AGENT_PORT ? Number(process.env.AGENT_PORT) : 3001

const agentConfig = {
  endpoint: process.env.AGENT_ENDPOINT || `http://localhost:${port}`,
  label: process.env.AGENT_LABEL || 'Aries Framework JavaScript Mediator',
  walletConfig: {
    id: process.env.WALLET_NAME || 'AriesFrameworkJavaScript',
    key: process.env.WALLET_KEY || 'AriesFrameworkJavaScript',
  },
  publicDidSeed: process.env.PUBLIC_DID_SEED || '000000000000000000HTTPMediator02',
  autoAcceptConnections: true,
  autoAcceptMediationRequests: true,
  logger: new TestLogger(LogLevel.debug),
}

// Set up agent
const agent = new Agent(agentConfig, agentDependencies)
const config = agent.injectionContainer.resolve(AgentConfig)
const inboundTransport = new HttpInboundTransport({ port })
const outboundTransport = new HttpOutboundTransport()

agent.registerInboundTransport(inboundTransport)
agent.registerOutboundTransport(outboundTransport)

// Allow to create invitation, no other way to ask for invitation yet
inboundTransport.app.get('/invitation', async (req, res) => {
  if (typeof req.query.c_i === 'string') {
    const invitation = await ConnectionInvitationMessage.fromUrl(req.url)
    res.send(invitation.toJSON())
  } else {
    const { invitation } = await agent.connections.createConnection()

    const httpEndpoint = config.endpoints.find((e) => e.startsWith('http'))
    res.send(invitation.toUrl(httpEndpoint + '/invitation'))
  }
})

const run = async () => {
  await agent.initialize()
}

run()
