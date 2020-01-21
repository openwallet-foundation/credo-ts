import { Connection } from './protocols/connections/domain/Connection';

type $FixMe = any;

export type WireMessage = $FixMe;

export interface InitConfig {
  url?: string;
  port?: string | number;
  label: string;
  walletName: string;
  walletKey: string;
  publicDid?: Did;
  publicDidSeed?: string;
  agencyUrl?: string;
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

const TYPES = {
  Agent: Symbol.for('Agent'),
  Context: Symbol.for('Context'),

  InitConfig: Symbol.for('InitConfig'),
  InboundConnection: Symbol.for('InboundConnection'),
  MessageSender: Symbol.for('MessageSender'),
  Dispatcher: Symbol.for('Dispatcher'),
  InboundTransporter: Symbol.for('InboundTransporter'),
  OutboundTransporter: Symbol.for('OutboundTransporter'),

  Wallet: Symbol.for('Wallet'),
  WalletConfig: Symbol.for('WalletConfig'),
  WalletCredentials: Symbol.for('WalletCredentials'),

  Handlers: Symbol.for('Handlers'),

  InvitationHandler: Symbol.for('InvitationHandler'),
  ConnectionRequestHandler: Symbol.for('ConnectionRequestHandler'),
  ConnectionResponseHandler: Symbol.for('ConnectionResponseHandler'),
  AckMessageHandler: Symbol.for('AckMessageHandler'),
  BasicMessageHandler: Symbol.for('BasicMessageHandler'),
  RouteUpdateHandler: Symbol.for('RouteUpdateHandler'),
  ForwardHandler: Symbol.for('ForwardHandler'),

  ConnectionService: Symbol.for('ConnectionService'),
  BasicMessageService: Symbol.for('BasicMessageService'),
  RoutingService: Symbol.for('RoutingService'),
  ProviderRoutingService: Symbol.for('ProviderRoutingService'),
  ConsumerRoutingService: Symbol.for('ConsumerRoutingService'),
  MessageReceiver: Symbol.for('MessageReceiver'),
};

export { TYPES };
