import { UnpackedMessageContext } from '../types';

export interface Wallet {
  init(): Promise<void>;
  close(): Promise<void>;
  delete(): Promise<void>;
  initPublicDid(didConfig: DidConfig): Promise<void>;
  getPublicDid(): DidInfo | undefined;
  createDid(didConfig?: DidConfig): Promise<[Did, Verkey]>;
  createCredentialDefinition(
    issuerDid: Did,
    schema: Schema,
    tag: string,
    signatureType: string,
    config?: CredDefConfig
  ): Promise<[CredDefId, CredDef]>;
  createCredentialOffer(credDefId: CredDefId): Promise<CredOffer>;
  pack(payload: Record<string, unknown>, recipientKeys: Verkey[], senderVk: Verkey | null): Promise<JsonWebKey>;
  unpack(messagePackage: JsonWebKey): Promise<UnpackedMessageContext>;
  sign(data: Buffer, verkey: Verkey): Promise<Buffer>;
  verify(signerVerkey: Verkey, data: Buffer, signature: Buffer): Promise<boolean>;
  addWalletRecord(type: string, id: string, value: string, tags: Record<string, string | undefined>): Promise<void>;
  updateWalletRecordValue(type: string, id: string, value: string): Promise<void>;
  updateWalletRecordTags(type: string, id: string, tags: Record<string, string | undefined>): Promise<void>;
  deleteWalletRecord(type: string, id: string): Promise<void>;
  getWalletRecord(type: string, id: string, options: WalletRecordOptions): Promise<WalletRecord>;
  search(type: string, query: WalletQuery, options: WalletSearchOptions): Promise<AsyncIterable<WalletRecord>>;
  signRequest(myDid: Did, request: LedgerRequest): Promise<LedgerRequest>;
}

export interface DidInfo {
  did: Did;
  verkey: Verkey;
}
