import type { InitConfig, AgentDependencies } from '@aries-framework/core'

import * as dotenv from 'dotenv'

import { TestLogger } from '../packages/core/tests/logger'

import { LogLevel } from '@aries-framework/core'
import { fetch, NodeFileSystem, EventEmitter, WebSocket, indy } from '@aries-framework/node'
dotenv.config()

const agentConfig: InitConfig = {
  host: process.env.AGENT_HOST,
  port: process.env.AGENT_PORT || 3000,
  endpoint: process.env.AGENT_ENDPOINT,
  label: process.env.AGENT_LABEL || '',
  walletConfig: { id: process.env.WALLET_NAME || '' },
  walletCredentials: { key: process.env.WALLET_KEY || '' },
  publicDidSeed: process.env.PUBLIC_DID_SEED || '',
  autoAcceptConnections: true,
  logger: new TestLogger(LogLevel.debug),
}

export const dependencies: AgentDependencies = {
  indy,
  NativeEventEmitter: EventEmitter,
  WebSocket,
  fetch,
  fileSystem: new NodeFileSystem(),
}

export default agentConfig
