import { InboundMessage, Message } from '../types';

export interface Wallet {
  init(): Promise<void>;
  close(): Promise<void>;
  delete(): Promise<void>;
  initPublicDid(did: Did, seed: string): Promise<void>;
  getPublicDid(): DidInfo | {};
  createDid(didConfig?: DidConfig): Promise<[Did, Verkey]>;
  pack(payload: {}, recipientKeys: Verkey[], senderVk: Verkey | null): Promise<JsonWebKey>;
  unpack(messagePackage: JsonWebKey): Promise<InboundMessage>;
  sign(message: Message, attribute: string, verkey: Verkey): Promise<Message>;
  verify(signerVerkey: Verkey, data: Buffer, signature: Buffer): Promise<boolean>;
}

export interface DidInfo {
  did: Did;
  verkey: Verkey;
}

export interface DidConfig {
  did: string;
  seed: string;
}

export interface WalletConfig {
  id: string;
}

export interface WalletCredentials {
  key: string;
}
