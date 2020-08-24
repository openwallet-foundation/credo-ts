/* eslint-disable no-console */
import { Wallet, DidConfig } from '../../wallet/Wallet';
import { Repository } from '../../storage/Repository';
import { StorageService } from '../../storage/StorageService';
import { CredentialService } from './CredentialService';
import { CredentialRecord } from '../../storage/CredentialRecord';
import { InboundMessageContext } from '../../agent/models/InboundMessageContext';
import { BaseRecord } from '../../storage/BaseRecord';

describe('CredentialService', () => {
  let wallet: Wallet;
  let storageService: StorageService<CredentialRecord>;
  let credentialRepository: Repository<CredentialRecord>;
  let credentialService: CredentialService;

  beforeAll(async () => {
    wallet = new StubWallet();
    storageService = new StubStorageService();
    await wallet.init();
  });

  afterAll(async () => {
    await wallet.close();
    await wallet.delete();
  });

  beforeEach(() => {
    credentialRepository = new Repository<CredentialRecord>(CredentialRecord, storageService);
    credentialService = new CredentialService(wallet, credentialRepository);
  });

  describe('createCredentialOffer', () => {
    it('returns credential offer message', async () => {
      const credentialOffer = await credentialService.createCredentialOffer({
        credDefId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
        comment: 'some comment',
      });

      console.log('Credential offer message JSON: ', credentialOffer.toJSON());

      expect(credentialOffer.toJSON()).toEqual(
        expect.objectContaining({
          '@id': expect.any(String),
          '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/offer-credential',
          comment: 'some comment',
          credential_preview: {},
          'offers~attach': [
            {
              '@id': expect.any(String),
              'mime-type': 'application/json',
              data: expect.anything(),
            },
          ],
        })
      );
    });
  });

  describe('acceptCredentialOffer', () => {
    it('creates credential base on credential offer message', async () => {
      const credentialOffer = await credentialService.createCredentialOffer({
        credDefId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
        comment: 'some comment',
      });

      const messageContext = new InboundMessageContext(credentialOffer);

      await credentialService.acceptCredentialOffer(messageContext);
      const [firstCredential] = await credentialService.getAll();

      expect(firstCredential).toEqual(
        expect.objectContaining({
          createdAt: expect.any(Number),
          id: expect.any(String),
          offer: credentialOffer,
          tags: {},
          type: 'CredentialRecord',
        })
      );
    });
  });
});

class StubWallet implements Wallet {
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
  getPublicDid(): import('../../wallet/Wallet').DidInfo | Record<string, undefined> {
    throw new Error('Method not implemented.');
  }
  createDid(didConfig?: import('../../wallet/Wallet').DidConfig | undefined): Promise<[string, string]> {
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
  unpack(messagePackage: JsonWebKey): Promise<import('../../types').UnpackedMessage> {
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

class StubStorageService<T extends BaseRecord> implements StorageService<T> {
  records: T[] = [];

  save(record: T): Promise<void> {
    this.records.push(record);
    return Promise.resolve();
  }
  update(record: T): Promise<void> {
    throw new Error('Method not implemented.');
  }
  delete(record: T): Promise<void> {
    throw new Error('Method not implemented.');
  }
  find(typeClass: new (...args: any[]) => T, id: string, type: string): Promise<T> {
    throw new Error('Method not implemented.');
  }
  findAll(typeClass: new (...args: any[]) => T, type: string): Promise<T[]> {
    console.log('StubStorageService findAll');
    return Promise.resolve(this.records);
  }
  findByQuery(typeClass: new (...args: any[]) => T, type: string, query: {}): Promise<T[]> {
    throw new Error('Method not implemented.');
  }
}
