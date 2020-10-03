/* eslint-disable @typescript-eslint/no-unused-vars */
import { Wallet, DidInfo } from '../../../wallet/Wallet';
import { UnpackedMessageContext } from '../../../types';

export class StubWallet implements Wallet {
  private wh?: number | undefined;
  public init(): Promise<void> {
    return Promise.resolve();
  }
  public close(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  public delete(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  public initPublicDid(didConfig: DidConfig): Promise<void> {
    throw new Error('Method not implemented.');
  }
  public getPublicDid(): DidInfo | undefined {
    throw new Error('Method not implemented.');
  }
  public createDid(didConfig?: DidConfig | undefined): Promise<[string, string]> {
    throw new Error('Method not implemented.');
  }
  public createCredentialDefinition(
    issuerDid: string,
    schema: Schema,
    tag: string,
    signatureType: string,
    config: CredDefConfig
  ): Promise<[string, CredDef]> {
    throw new Error('Method not implemented.');
  }
  public createCredentialOffer(credDefId: string): Promise<CredOffer> {
    return Promise.resolve({
      schema_id: 'aaa',
      cred_def_id: credDefId,
      // Fields below can depend on Cred Def type
      nonce: 'nonce',
      key_correctness_proof: {},
    });
  }
  public createCredentialRequest(
    proverDid: string,
    offer: CredOffer,
    credDef: CredDef,
    masterSecretName: string
  ): Promise<[CredReq, CredReqMetadata]> {
    return Promise.resolve([
      {
        prover_did: proverDid,
        cred_def_id: credDef.id,
        blinded_ms: {},
        blinded_ms_correctness_proof: {},
        nonce: 'nonce',
      },
      { cred_req: 'meta-data' },
    ]);
  }
  public createCredential(
    credOffer: CredOffer,
    credReq: CredReq,
    credValues: CredValues
  ): Promise<[Cred, CredRevocId, RevocRegDelta]> {
    return Promise.resolve([
      {
        schema_id: 'schema_id',
        cred_def_id: 'cred_def_id',
        rev_reg_def_id: 'rev_reg_def_id',
        values: {},
        signature: 'signature',
        signature_correctness_proof: 'signature_correctness_proof',
      },
      '1',
      {},
    ]);
  }
  public storeCredential(credentialId: CredentialId): Promise<string> {
    return Promise.resolve(credentialId);
  }
  public pack(payload: Record<string, unknown>, recipientKeys: string[], senderVk: string | null): Promise<JsonWebKey> {
    throw new Error('Method not implemented.');
  }
  public unpack(messagePackage: JsonWebKey): Promise<UnpackedMessageContext> {
    throw new Error('Method not implemented.');
  }
  public sign(data: Buffer, verkey: string): Promise<Buffer> {
    throw new Error('Method not implemented.');
  }
  public verify(signerVerkey: string, data: Buffer, signature: Buffer): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  public addWalletRecord(type: string, id: string, value: string, tags: Record<string, string>): Promise<void> {
    throw new Error('Method not implemented.');
  }
  public updateWalletRecordValue(type: string, id: string, value: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  public updateWalletRecordTags(type: string, id: string, tags: Record<string, string>): Promise<void> {
    throw new Error('Method not implemented.');
  }
  public deleteWalletRecord(type: string, id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  public getWalletRecord(type: string, id: string, options: WalletRecordOptions): Promise<WalletRecord> {
    throw new Error('Method not implemented.');
  }
  public search(type: string, query: WalletQuery, options: WalletRecordOptions): Promise<AsyncIterable<WalletRecord>> {
    throw new Error('Method not implemented.');
  }
  public signRequest(myDid: string, request: LedgerRequest): Promise<LedgerRequest> {
    throw new Error('Method not implemented.');
  }
}
