import { WalletConfig, WalletCredentials } from './wallet/Wallet';
import { ConnectionRecord } from './storage/ConnectionRecord';
import { AgentMessage } from './agent/AgentMessage';

type $FixMe = any;

export type WireMessage = $FixMe;

export interface InitConfig {
  url?: string;
  port?: string | number;
  label: string;
  publicDid?: Did;
  publicDidSeed?: string;
  agencyUrl?: string;
  walletConfig: WalletConfig;
  walletCredentials: WalletCredentials;
}

export interface Message {
  '@id': string;
  '@type': string;
  [key: string]: any;
}

export interface UnpackedMessage {
  message: any;
  sender_verkey: Verkey; // TODO make it optional
  recipient_verkey: Verkey; // TODO make it optional
}

export interface InboundMessage<T extends AgentMessage = AgentMessage> {
  message: T;
  sender_verkey: Verkey; // TODO make it optional
  recipient_verkey: Verkey; // TODO make it optional
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
