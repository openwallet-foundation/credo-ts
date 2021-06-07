import indy from 'indy-sdk'
import * as dotenv from 'dotenv'
import { InitConfig } from '../src/types'
import { NodeFileSystem } from '../src/storage/fs/NodeFileSystem'
import { TestLogger } from '../src/__tests__/logger'
import { LogLevel } from '../src/logger'
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
  indy,
  fileSystem: new NodeFileSystem(),
}

export default agentConfig
