import { UnpackedMessageContext } from '../types';

export interface Wallet {
  wh?: WalletHandle;
  init(): Promise<void>;
  close(): Promise<void>;
  delete(): Promise<void>;
  initPublicDid(didConfig: DidConfig): Promise<void>;
  getPublicDid(): DidInfo | Record<string, undefined>;
  createDid(didConfig?: DidConfig): Promise<[Did, Verkey]>;
  createCredentialDefinition(
    issuerDid: Did,
    schema: Schema,
    tag: string,
    signatureType: string,
    config?: CredDefConfig
  ): Promise<[CredDefId, CredDef]>;
  pack(payload: {}, recipientKeys: Verkey[], senderVk: Verkey | null): Promise<JsonWebKey>;
  unpack(messagePackage: JsonWebKey): Promise<UnpackedMessageContext>;
  sign(data: Buffer, verkey: Verkey): Promise<Buffer>;
  verify(signerVerkey: Verkey, data: Buffer, signature: Buffer): Promise<boolean>;
  addWalletRecord(type: string, id: string, value: string, tags: {}): Promise<void>;
  updateWalletRecordValue(type: string, id: string, value: string): Promise<void>;
  updateWalletRecordTags(type: string, id: string, tags: {}): Promise<void>;
  deleteWalletRecord(type: string, id: string): Promise<void>;
  getWalletRecord(type: string, id: string, options: {}): Promise<WalletRecord>;
  search(type: string, query: {}, options: {}): Promise<AsyncIterable<WalletRecord>>;
  signRequest(myDid: Did, request: LedgerRequest): Promise<LedgerRequest>;
}

export interface DidInfo {
  did: Did;
  verkey: Verkey;
}

export interface DidConfig {
  did?: string;
  seed?: string;
  crypto_type?: string;
  cid?: boolean;
  method_name?: string;
}

export interface WalletConfig {
  id: string;
  storage_type?: string;
  storage_config?: WalletStorageConfig;
}

export interface WalletStorageConfig {
  path?: string;
}

export interface WalletCredentials {
  key: string;
  storage_credentials?: {};
  key_derivation_method?: WalletKeyDerivationMethod;
}

export enum WalletKeyDerivationMethod {
  ARGON2I_MOD = 'ARGON2I_MOD',
  ARGON2I_INT = 'ARGON2I_INT',
  RAW = 'RAW',
}
