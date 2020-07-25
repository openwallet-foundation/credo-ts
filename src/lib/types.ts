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

export interface UnpackedMessage {
  message: {
    '@type': string;
    [key: string]: any;
  };
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
