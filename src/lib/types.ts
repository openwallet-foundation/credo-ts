import { ConnectionRecord } from './storage/ConnectionRecord';
import { AgentMessage } from './agent/AgentMessage';

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
  walletConfig: WalletConfig;
  walletCredentials: WalletCredentials;
  autoAcceptConnections?: boolean;
  genesisPath?: string;
  poolName?: string;
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
