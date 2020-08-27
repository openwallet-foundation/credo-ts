/* eslint-disable @typescript-eslint/no-unused-vars */
import { Wallet, DidConfig, DidInfo } from '../../../wallet/Wallet';
import { UnpackedMessage } from '../../../types';

export class StubWallet implements Wallet {
  wh?: number | undefined;
  init(): Promise<void> {
    return Promise.resolve();
  }
  close(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  delete(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  initPublicDid(didConfig: DidConfig): Promise<void> {
    throw new Error('Method not implemented.');
  }
  getPublicDid(): DidInfo | Record<string, undefined> {
    throw new Error('Method not implemented.');
  }
  createDid(didConfig?: DidConfig | undefined): Promise<[string, string]> {
    throw new Error('Method not implemented.');
  }
  createCredDef(
    issuerDid: string,
    schema: Schema,
    tag: string,
    signatureType: string,
    config: {}
  ): Promise<[string, CredDef]> {
    throw new Error('Method not implemented.');
  }
  createCredentialOffer(credDefId: string): Promise<CredOffer> {
    return Promise.resolve({
      schema_id: 'aaa',
      cred_def_id: credDefId,
      // Fields below can depend on Cred Def type
      nonce: 'nonce',
      key_correctness_proof: 'key_correctness_proof',
    });
  }
  pack(payload: {}, recipientKeys: string[], senderVk: string | null): Promise<JsonWebKey> {
    throw new Error('Method not implemented.');
  }
  unpack(messagePackage: JsonWebKey): Promise<UnpackedMessage> {
    throw new Error('Method not implemented.');
  }
  sign(data: Buffer, verkey: string): Promise<Buffer> {
    throw new Error('Method not implemented.');
  }
  verify(signerVerkey: string, data: Buffer, signature: Buffer): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  addWalletRecord(type: string, id: string, value: string, tags: {}): Promise<void> {
    throw new Error('Method not implemented.');
  }
  updateWalletRecordValue(type: string, id: string, value: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  updateWalletRecordTags(type: string, id: string, tags: {}): Promise<void> {
    throw new Error('Method not implemented.');
  }
  deleteWalletRecord(type: string, id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  getWalletRecord(type: string, id: string, options: {}): Promise<WalletRecord> {
    throw new Error('Method not implemented.');
  }
  search(type: string, query: {}, options: {}): Promise<AsyncIterable<WalletRecord>> {
    throw new Error('Method not implemented.');
  }
  signRequest(myDid: string, request: LedgerRequest): Promise<LedgerRequest> {
    throw new Error('Method not implemented.');
  }
}
