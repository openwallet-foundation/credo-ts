import type Indy from 'indy-sdk';
import type { Did, WalletConfig, WalletCredentials, Verkey } from 'indy-sdk';
import { ConnectionRecord } from './modules/connections';
import { AgentMessage } from './agent/AgentMessage';
import { Logger } from './logger';

type $FixMe = any;

export type WireMessage = $FixMe;

export interface InitConfig {
  host?: string;
  port?: string | number;
  endpoint?: string;
  label: string;
  publicDid?: Did;
  publicDidSeed?: string;
  mediatorUrl?: string;
  mediatorRecordId?: string;
  walletConfig: WalletConfig;
  walletCredentials: WalletCredentials;
  autoAcceptConnections?: boolean;
  genesisPath?: string;
  poolName?: string;
  logger?: Logger;
  indy: typeof Indy;
}

export interface UnpackedMessage {
  '@type': string;
  [key: string]: unknown;
}

export interface UnpackedMessageContext {
  message: UnpackedMessage;
  sender_verkey?: Verkey;
  recipient_verkey?: Verkey;
}

export interface OutboundMessage<T extends AgentMessage = AgentMessage> {
  connection: ConnectionRecord;
  endpoint?: string;
  payload: T;
  recipientKeys: Verkey[];
  routingKeys: Verkey[];
  senderVk: Verkey | null;
}

export interface OutboundPackage {
  connection: ConnectionRecord;
  payload: WireMessage;
  endpoint?: string;
}

export interface InboundConnection {
  verkey: Verkey;
  connection: ConnectionRecord;
}
