/* eslint-disable no-console */
import { Wallet } from '../../../wallet/Wallet';
import { Repository } from '../../../storage/Repository';
import { StorageService } from '../../../storage/StorageService';
import { CredentialService, EventType } from '../CredentialService';
import { CredentialRecord } from '../../../storage/CredentialRecord';
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext';
import { CredentialState } from '../CredentialState';
import { StubWallet } from './StubWallet';
import { StubStorageService } from './StubStorageService';
import { CredentialPreview } from '../messages/CredentialOfferMessage';

const preview = new CredentialPreview({
  attributes: [
    {
      name: 'name',
      mimeType: 'text/plain',
      value: 'John',
    },
    {
      name: 'age',
      mimeType: 'text/plain',
      value: '99',
    },
  ],
});

describe('CredentialService', () => {
  let wallet: Wallet;
  let storageService: StorageService<CredentialRecord>;
  let credentialRepository: Repository<CredentialRecord>;
  let credentialService: CredentialService;

  beforeAll(async () => {
    wallet = new StubWallet();
    await wallet.init();
  });

  afterAll(async () => {
    await wallet.close();
    await wallet.delete();
  });

  describe('createCredentialOffer', () => {
    beforeEach(() => {
      storageService = new StubStorageService();
      credentialRepository = new Repository<CredentialRecord>(CredentialRecord, storageService);
      credentialService = new CredentialService(wallet, credentialRepository);
    });

    test('returns credential offer message', async () => {
      const credentialOffer = await credentialService.createCredentialOffer({
        credDefId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
        comment: 'some comment',
        preview,
      });

      expect(credentialOffer.toJSON()).toEqual(
        expect.objectContaining({
          '@id': expect.any(String),
          '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/offer-credential',
          comment: 'some comment',
          credential_preview: expect.any(Object),
          'offers~attach': [
            {
              '@id': expect.any(String),
              'mime-type': 'application/json',
              data: {
                base64: expect.any(String),
              },
            },
          ],
        })
      );

      // @ts-ignore
      expect(credentialOffer.toJSON().credential_preview).toEqual({
        type: 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/credential-preview',
        attributes: [
          {
            name: 'name',
            mimeType: 'text/plain',
            value: 'John',
          },
          {
            name: 'age',
            mimeType: 'text/plain',
            value: '99',
          },
        ],
      });
    });

    test('creates credential in OFFER_SENT state', async () => {
      const credentialOffer = await credentialService.createCredentialOffer({
        credDefId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
        comment: 'some comment',
        preview,
      });
      const [firstCredential] = await credentialService.getAll();

      expect(firstCredential).toEqual(
        expect.objectContaining({
          createdAt: expect.any(Number),
          id: expect.any(String),
          offer: credentialOffer,
          tags: {},
          type: 'CredentialRecord',
          state: CredentialState.OfferSent,
        })
      );
    });

    test(`emits stateChange event with ${CredentialState.OfferSent}`, async () => {
      const eventListenerMock = jest.fn();
      credentialService.on(EventType.StateChanged, eventListenerMock);

      await credentialService.createCredentialOffer({
        credDefId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
        comment: 'some comment',
        preview,
      });

      expect(eventListenerMock).toHaveBeenCalledWith(
        expect.objectContaining({
          newState: CredentialState.OfferSent,
          credentialId: expect.any(String),
        })
      );
    });
  });

  describe('acceptCredentialOffer', () => {
    beforeEach(() => {
      storageService = new StubStorageService();
      credentialRepository = new Repository<CredentialRecord>(CredentialRecord, storageService);
      credentialService = new CredentialService(wallet, credentialRepository);
    });

    test('creates credential in OFFER base on credential offer message', async () => {
      const credentialOffer = await credentialService.createCredentialOffer({
        credDefId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
        comment: 'some comment',
        preview,
      });
      const messageContext = new InboundMessageContext(credentialOffer);

      await credentialService.acceptCredentialOffer(messageContext);
      const [, secondCredential] = await credentialService.getAll();

      expect(secondCredential).toEqual(
        expect.objectContaining({
          createdAt: expect.any(Number),
          id: expect.any(String),
          offer: credentialOffer,
          tags: {},
          type: 'CredentialRecord',
          state: CredentialState.OfferReceived,
        })
      );
    });

    test(`emits stateChange event with ${CredentialState.OfferReceived}`, async () => {
      const eventListenerMock = jest.fn();
      credentialService.on(EventType.StateChanged, eventListenerMock);

      const credentialOffer = await credentialService.createCredentialOffer({
        credDefId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
        comment: 'some comment',
        preview,
      });
      const messageContext = new InboundMessageContext(credentialOffer);

      await credentialService.acceptCredentialOffer(messageContext);

      expect(eventListenerMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          newState: CredentialState.OfferReceived,
          credentialId: expect.any(String),
        })
      );
    });
  });
});
