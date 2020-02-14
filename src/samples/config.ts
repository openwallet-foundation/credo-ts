import * as dotenv from 'dotenv';
dotenv.config();

export default {
  url: process.env.AGENT_URL || '',
  port: process.env.AGENT_PORT || 3000,
  label: process.env.AGENT_LABEL || '',
  walletConfig: { id: process.env.WALLET_NAME || '' },
  walletCredentials: { key: process.env.WALLET_KEY || '' },
  publicDid: process.env.PUBLIC_DID || '',
  publicDidSeed: process.env.PUBLIC_DID_SEED || '',
};
