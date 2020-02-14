import { Connection } from './protocols/connections/domain/Connection';
import { WalletConfig, WalletCredentials } from './wallet/Wallet';

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

export interface InboundMessage {
  message: Message;
  sender_verkey: Verkey; // TODO make it optional
  recipient_verkey: Verkey; // TODO make it optional
}

export interface OutboundMessage {
  connection: Connection;
  endpoint?: string;
  payload: Message;
  recipientKeys: Verkey[];
  routingKeys: Verkey[];
  senderVk: Verkey | null;
}

export interface OutboundPackage {
  connection: Connection;
  payload: WireMessage;
  endpoint?: string;
}

export interface InboundConnection {
  verkey: Verkey;
  connection: Connection;
}
