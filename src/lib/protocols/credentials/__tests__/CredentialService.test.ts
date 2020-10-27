/* eslint-disable no-console */
import { Wallet } from '../../../wallet/Wallet';
import { Repository } from '../../../storage/Repository';
import { CredentialService, EventType } from '../CredentialService';
import { CredentialRecord } from '../../../storage/CredentialRecord';
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext';
import { CredentialState } from '../CredentialState';
import { StubWallet } from './StubWallet';
import {
  CredentialOfferMessage,
  CredentialPreview,
  CredentialPreviewAttribute,
} from '../messages/CredentialOfferMessage';
import { ConnectionRecord } from '../../../storage/ConnectionRecord';
import { JsonEncoder } from '../../../utils/JsonEncoder';
import { Attachment } from '../messages/Attachment';
import { CredentialRequestMessage } from '../messages/CredentialRequestMessage';
import { CredentialResponseMessage } from '../messages/CredentialResponseMessage';
import { credDef, credOffer, credReq } from './fixtures';

jest.mock('./../../../storage/Repository');

const CredentialRepository = <jest.Mock<Repository<CredentialRecord>>>(<unknown>Repository);

const connection = { id: '123' } as ConnectionRecord;

const preview = new CredentialPreview({
  attributes: [
    new CredentialPreviewAttribute({
      name: 'name',
      mimeType: 'text/plain',
      value: 'John',
    }),
    new CredentialPreviewAttribute({
      name: 'age',
      mimeType: 'text/plain',
      value: '99',
    }),
  ],
});

const attachment = new Attachment({
  id: '6526420d-8d1c-4f70-89de-54c9f3fa9f5c',
  mimeType: '',
  data: {
    base64:
      'eyJzY2hlbWFfaWQiOiJhYWEiLCJjcmVkX2RlZl9pZCI6IlRoN01wVGFSWlZSWW5QaWFiZHM4MVk6MzpDTDoxNzpUQUciLCJub25jZSI6Im5vbmNlIiwia2V5X2NvcnJlY3RuZXNzX3Byb29mIjp7fX0',
  },
});

const requestAttachment = new Attachment({
  id: '6526420d-8d1c-4f70-89de-54c9f3fa9f5c',
  mimeType: '',
  data: {
    base64: JsonEncoder.toBase64(credReq),
  },
});

// A record is deserialized to JSON when it's stored into the storage. We want to simulate this behaviour for `offer`
// object to test our service would behave correctly. We use type assertion for `offer` attribute to `any`.
const mockCredentialRecord = ({
  state,
  request,
  requestMetadata,
  tags,
}: {
  state: CredentialState;
  request?: CredReq;
  requestMetadata?: CredReqMetadata;
  tags?: Record<string, unknown>;
}) =>
  new CredentialRecord({
    offer: new CredentialOfferMessage({
      comment: 'some comment',
      credentialPreview: preview,
      attachments: [attachment],
    }).toJSON(),
    request: request,
    requestMetadata: requestMetadata,
    state: state || CredentialState.OfferSent,
    tags: tags || {},
    connectionId: '123',
  } as any);

describe('CredentialService', () => {
  let wallet: Wallet;
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
      credentialRepository = new CredentialRepository();
      credentialService = new CredentialService(wallet, credentialRepository);
    });

    test('creates credential in OFFER_SENT state', async () => {
      const repositorySaveSpy = jest.spyOn(credentialRepository, 'save');

      const credentialOffer = await credentialService.createCredentialOffer(connection, {
        credDefId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
        comment: 'some comment',
        preview,
      });

      const [[createdCredentialRecord]] = repositorySaveSpy.mock.calls;
      expect(createdCredentialRecord).toMatchObject({
        createdAt: expect.any(Number),
        id: expect.any(String),
        offer: credentialOffer,
        tags: { threadId: createdCredentialRecord.offer.id },
        type: CredentialRecord.name,
        state: 'OFFER_SENT',
      });
    });

    test(`emits stateChange event with a new credential in OFFER_SENT state`, async () => {
      const eventListenerMock = jest.fn();
      credentialService.on(EventType.StateChanged, eventListenerMock);

      await credentialService.createCredentialOffer(connection, {
        credDefId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
        comment: 'some comment',
        preview,
      });

      expect(eventListenerMock).toHaveBeenCalledTimes(1);

      const [[event]] = eventListenerMock.mock.calls;
      expect(event).toMatchObject({
        credential: {
          state: 'OFFER_SENT',
        },
        prevState: null,
      });
    });

    test('returns credential offer message', async () => {
      const credentialOffer = await credentialService.createCredentialOffer(connection, {
        credDefId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
        comment: 'some comment',
        preview,
      });

      expect(credentialOffer.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/offer-credential',
        comment: 'some comment',
        credential_preview: {
          '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/credential-preview',
          attributes: [
            {
              name: 'name',
              'mime-type': 'text/plain',
              value: 'John',
            },
            {
              name: 'age',
              'mime-type': 'text/plain',
              value: '99',
            },
          ],
        },
        'offers~attach': [
          {
            '@id': expect.any(String),
            'mime-type': 'application/json',
            data: {
              base64: expect.any(String),
            },
          },
        ],
      });
    });
  });

  describe('processCredentialOffer', () => {
    beforeEach(() => {
      credentialRepository = new CredentialRepository();
      credentialService = new CredentialService(wallet, credentialRepository);
    });

    test('creates credential in OFFER_RECEIVED state based on credential offer message', async () => {
      const repositorySaveSpy = jest.spyOn(credentialRepository, 'save');

      const credentialOfferMessage = new CredentialOfferMessage({
        comment: 'some comment',
        credentialPreview: preview,
        attachments: [attachment],
      });

      const messageContext = new InboundMessageContext(credentialOfferMessage);
      messageContext.connection = connection;

      await credentialService.processCredentialOffer(messageContext);

      const [[createdCredentialRecord]] = repositorySaveSpy.mock.calls;
      expect(createdCredentialRecord).toMatchObject({
        createdAt: expect.any(Number),
        id: expect.any(String),
        offer: credentialOfferMessage,
        tags: { threadId: credentialOfferMessage.id },
        type: CredentialRecord.name,
        state: 'OFFER_RECEIVED',
      });
    });

    test(`emits stateChange event with OFFER_RECEIVED`, async () => {
      const eventListenerMock = jest.fn();
      credentialService.on(EventType.StateChanged, eventListenerMock);

      const credentialOfferMessage = new CredentialOfferMessage({
        comment: 'some comment',
        credentialPreview: preview,
        attachments: [attachment],
      });

      const messageContext = new InboundMessageContext(credentialOfferMessage);
      messageContext.connection = connection;

      await credentialService.processCredentialOffer(messageContext);

      expect(eventListenerMock).toHaveBeenCalledTimes(1);

      const [[event]] = eventListenerMock.mock.calls;
      expect(event).toMatchObject({
        credential: {
          state: 'OFFER_RECEIVED',
        },
        prevState: null,
      });
    });
  });

  describe('createCredentialRequest', () => {
    beforeEach(() => {
      credentialRepository = new CredentialRepository();
      credentialService = new CredentialService(wallet, credentialRepository);
    });

    test('updates credential to REQUEST_SENT state', async () => {
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update');
      const credential = mockCredentialRecord({ state: CredentialState.OfferReceived });
      await credentialService.createCredentialRequest(connection, credential, credDef);

      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1);

      const [[updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls;
      expect(updatedCredentialRecord).toMatchObject({
        requestMetadata: { cred_req: 'meta-data' },
        type: CredentialRecord.name,
        state: 'REQUEST_SENT',
      });
    });

    test(`emits stateChange event with REQUEST_SENT`, async () => {
      const eventListenerMock = jest.fn();
      credentialService.on(EventType.StateChanged, eventListenerMock);

      const credential = mockCredentialRecord({ state: CredentialState.OfferReceived });
      await credentialService.createCredentialRequest(connection, credential, credDef);

      expect(eventListenerMock).toHaveBeenCalledTimes(1);

      const [[event]] = eventListenerMock.mock.calls;
      expect(event).toMatchObject({
        prevState: 'OFFER_RECEIVED',
        credential: {
          state: 'REQUEST_SENT',
        },
      });
    });

    test('returns credential request message base on existing credential offer message', async () => {
      const credential = mockCredentialRecord({
        state: CredentialState.OfferReceived,
        tags: { threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746' },
      });
      const credentialRequest = await credentialService.createCredentialRequest(connection, credential, credDef);

      expect(credentialRequest.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/request-credential',
        '~thread': {
          thid: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        },
        comment: 'some credential request comment',
        'requests~attach': [
          {
            '@id': expect.any(String),
            'mime-type': 'application/json',
            data: {
              base64: expect.any(String),
            },
          },
        ],
      });
    });
  });

  describe('processCredentialRequest', () => {
    let repositoryFindMock: jest.Mock<Promise<CredentialRecord[]>, [WalletQuery]>;

    beforeEach(() => {
      credentialRepository = new CredentialRepository();
      credentialService = new CredentialService(wallet, credentialRepository);
      // make separate mockFind variable to get the correct jest mock typing
      repositoryFindMock = credentialRepository.findByQuery as jest.Mock<Promise<CredentialRecord[]>, [WalletQuery]>;
    });

    test('updates credential to REQUEST_RECEIVED state', async () => {
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update');
      repositoryFindMock.mockReturnValue(Promise.resolve([mockCredentialRecord({ state: CredentialState.OfferSent })]));

      const credentialRequest = new CredentialRequestMessage({ comment: 'abcd', attachments: [requestAttachment] });
      credentialRequest.setThread({ threadId: 'somethreadid' });
      const messageContext = new InboundMessageContext(credentialRequest);

      await credentialService.processCredentialRequest(messageContext);

      const [[findByQueryArg]] = repositoryFindMock.mock.calls;
      expect(findByQueryArg).toEqual({ threadId: 'somethreadid' });

      const [[updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls;
      expect(updatedCredentialRecord).toMatchObject({
        state: 'REQUEST_RECEIVED',
        request: credReq,
      });
    });

    test(`emits stateChange event from OFFER_SENT to REQUEST_RECEIVED`, async () => {
      const eventListenerMock = jest.fn();
      credentialService.on(EventType.StateChanged, eventListenerMock);
      repositoryFindMock.mockReturnValue(Promise.resolve([mockCredentialRecord({ state: CredentialState.OfferSent })]));

      const credentialRequest = new CredentialRequestMessage({ comment: 'abcd', attachments: [requestAttachment] });
      credentialRequest.setThread({ threadId: 'somethreadid' });
      const messageContext = new InboundMessageContext(credentialRequest);

      await credentialService.processCredentialRequest(messageContext);

      expect(eventListenerMock).toHaveBeenCalledTimes(1);

      const [[event]] = eventListenerMock.mock.calls;
      expect(event).toMatchObject({
        credential: {
          state: 'REQUEST_RECEIVED',
        },
        prevState: 'OFFER_SENT',
      });
    });
  });

  describe('createCredentialResponse', () => {
    let repositoryFindMock: jest.Mock<Promise<CredentialRecord>, [string]>;

    beforeEach(() => {
      credentialRepository = new CredentialRepository();
      credentialService = new CredentialService(wallet, credentialRepository);
      // make separate mockFind variable to get the correct jest mock typing
      repositoryFindMock = credentialRepository.find as jest.Mock<Promise<CredentialRecord>, [string]>;
    });

    test('updates credential to CREDENTIAL_ISSUED state', async () => {
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update');
      const credential = mockCredentialRecord({ state: CredentialState.RequestReceived, request: credReq });
      repositoryFindMock.mockReturnValue(Promise.resolve(credential));

      const comment = 'credential response comment';
      await credentialService.createCredentialResponse(credential.id, { comment });

      const [[updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls;
      expect(updatedCredentialRecord).toMatchObject({
        state: 'CREDENTIAL_ISSUED',
      });
    });

    test(`emits stateChange event from REQUEST_RECEIVED to CREDENTIAL_ISSUED`, async () => {
      const eventListenerMock = jest.fn();
      credentialService.on(EventType.StateChanged, eventListenerMock);
      const credential = mockCredentialRecord({ state: CredentialState.RequestReceived, request: credReq });
      repositoryFindMock.mockReturnValue(Promise.resolve(credential));

      const comment = 'credential response comment';
      await credentialService.createCredentialResponse(credential.id, { comment });
      expect(eventListenerMock).toHaveBeenCalledTimes(1);

      const [[event]] = eventListenerMock.mock.calls;
      expect(event).toMatchObject({
        credential: {
          state: 'CREDENTIAL_ISSUED',
        },
        prevState: 'REQUEST_RECEIVED',
      });
    });

    test('returns credential response message base on credential request message', async () => {
      const credential = mockCredentialRecord({
        state: CredentialState.RequestReceived,
        request: credReq,
        tags: { threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746' },
      });
      repositoryFindMock.mockReturnValue(Promise.resolve(credential));

      const comment = 'credential response comment';
      const credentialResponse = await credentialService.createCredentialResponse(credential.id, { comment });

      expect(credentialResponse.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/issue-credential',
        '~thread': {
          thid: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        },
        comment,
        'credentials~attach': [
          {
            '@id': expect.any(String),
            'mime-type': 'application/json',
            data: {
              base64: expect.any(String),
            },
          },
        ],
        '~please_ack': expect.any(Object),
      });

      // We're using instance of `StubWallet`. Value of `cred` should be as same as in the credential response message.
      const [cred] = await wallet.createCredential(credOffer, credReq, {});
      const [responseAttachment] = credentialResponse.attachments;
      expect(JsonEncoder.fromBase64(responseAttachment.data.base64)).toEqual(cred);
    });
  });

  describe('processCredentialResponse', () => {
    let repositoryFindMock: jest.Mock<Promise<CredentialRecord[]>, [WalletQuery]>;
    let credential: CredentialRecord;
    let messageContext: InboundMessageContext<CredentialResponseMessage>;

    beforeEach(() => {
      credential = mockCredentialRecord({
        state: CredentialState.RequestSent,
        requestMetadata: { cred_req: 'meta-data' },
      });

      const credentialResponse = new CredentialResponseMessage({ comment: 'abcd', attachments: [attachment] });
      credentialResponse.setThread({ threadId: 'somethreadid' });
      messageContext = new InboundMessageContext(credentialResponse);

      credentialRepository = new CredentialRepository();
      credentialService = new CredentialService(wallet, credentialRepository);
      // make separate mockFind variable to get the correct jest mock typing
      repositoryFindMock = credentialRepository.findByQuery as jest.Mock<Promise<CredentialRecord[]>, [WalletQuery]>;
    });

    test('stores credential from incoming credential response message into given credential record', async () => {
      // given
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update');
      const walletSaveSpy = jest.spyOn(wallet, 'storeCredential');
      repositoryFindMock.mockReturnValue(Promise.resolve([credential]));

      // when
      await credentialService.processCredentialResponse(messageContext, credDef);

      // then
      expect(repositoryFindMock).toHaveBeenCalledTimes(1);
      const [[findByQueryArg]] = repositoryFindMock.mock.calls;
      expect(findByQueryArg).toEqual({ threadId: 'somethreadid' });

      expect(walletSaveSpy).toHaveBeenCalledTimes(1);
      const [[...walletSaveArgs]] = walletSaveSpy.mock.calls;
      expect(walletSaveArgs).toEqual(
        expect.arrayContaining([
          expect.any(String),
          { cred_req: 'meta-data' },
          {
            schema_id: 'aaa',
            cred_def_id: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
            nonce: 'nonce',
            key_correctness_proof: {},
          },
          credDef,
        ])
      );

      const [[updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls;
      expect(updatedCredentialRecord).toMatchObject({
        type: CredentialRecord.name,
        id: expect.any(String),
        credentialId: expect.any(String),
        state: CredentialState.CredentialReceived,
      });
    });

    test(`emits stateChange event from REQUEST_SENT to CREDENTIAL_RECEIVED`, async () => {
      const eventListenerMock = jest.fn();
      credentialService.on(EventType.StateChanged, eventListenerMock);
      repositoryFindMock.mockReturnValue(Promise.resolve([credential]));

      await credentialService.processCredentialResponse(messageContext, credDef);

      expect(eventListenerMock).toHaveBeenCalledTimes(1);

      const [[event]] = eventListenerMock.mock.calls;
      expect(event).toMatchObject({
        prevState: 'REQUEST_SENT',
        credential: {
          state: 'CREDENTIAL_RECEIVED',
        },
      });
    });

    test(`returns updated credential record`, async () => {
      repositoryFindMock.mockReturnValue(Promise.resolve([credential]));

      const updatedCredential = await credentialService.processCredentialResponse(messageContext, credDef);

      expect(updatedCredential).toMatchObject({
        type: CredentialRecord.name,
        id: expect.any(String),
        credentialId: expect.any(String),
        state: 'CREDENTIAL_RECEIVED',
      });
    });
  });

  describe('createAck', () => {
    let repositoryFindMock: jest.Mock<Promise<CredentialRecord>, [string]>;
    let credential: CredentialRecord;

    beforeEach(() => {
      credential = mockCredentialRecord({
        state: CredentialState.CredentialReceived,
        tags: { threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746' },
      });

      credentialRepository = new CredentialRepository();
      credentialService = new CredentialService(wallet, credentialRepository);
      // make separate mockFind variable to get the correct jest mock typing
      repositoryFindMock = credentialRepository.find as jest.Mock<Promise<CredentialRecord>, [string]>;
    });

    test('updates credential state', async () => {
      // given
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update');
      repositoryFindMock.mockReturnValue(Promise.resolve(credential));

      // when
      await credentialService.createAck(credential.id);

      // then
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1);
      const [[updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls;
      expect(updatedCredentialRecord).toMatchObject({
        state: 'DONE',
      });
    });

    test(`emits stateChange event from CREDENTIAL_RECEIVED to DONE`, async () => {
      const eventListenerMock = jest.fn();
      credentialService.on(EventType.StateChanged, eventListenerMock);

      // given
      repositoryFindMock.mockReturnValue(Promise.resolve(credential));

      // when
      await credentialService.createAck(credential.id);

      // then
      expect(eventListenerMock).toHaveBeenCalledTimes(1);
      const [[event]] = eventListenerMock.mock.calls;
      expect(event).toMatchObject({
        prevState: 'CREDENTIAL_RECEIVED',
        credential: {
          state: 'DONE',
        },
      });
    });

    test('returns credential response message base on credential request message', async () => {
      // given
      repositoryFindMock.mockReturnValue(Promise.resolve(credential));

      // when
      const ackMessage = await credentialService.createAck(credential.id);

      // then
      expect(ackMessage.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/ack',
        '~thread': {
          thid: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        },
      });
    });
  });
});
