import * as dotenv from 'dotenv';
import { InitConfig } from '../lib/types';
dotenv.config();

const agentConfig: InitConfig = {
  url: process.env.AGENT_URL || '',
  port: process.env.AGENT_PORT || 3000,
  label: process.env.AGENT_LABEL || '',
  walletConfig: { id: process.env.WALLET_NAME || '' },
  walletCredentials: { key: process.env.WALLET_KEY || '' },
  publicDid: process.env.PUBLIC_DID || '',
  publicDidSeed: process.env.PUBLIC_DID_SEED || '',
  autoAcceptConnections: true,
};

export default agentConfig;
