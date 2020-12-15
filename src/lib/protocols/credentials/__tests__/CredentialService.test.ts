/* eslint-disable no-console */
import { Wallet } from '../../../wallet/Wallet';
import { Repository } from '../../../storage/Repository';
import { CredentialOfferTemplate, CredentialService, EventType } from '../CredentialService';
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
import { CredentialRequestMessage } from '../messages/CredentialRequestMessage';
import { CredentialResponseMessage } from '../messages/CredentialResponseMessage';
import { credDef, credOffer, credReq } from './fixtures';
import { CredentialAckMessage } from '../messages/CredentialAckMessage';
import { Attachment, AttachmentData } from '../../../decorators/attachment/Attachment';

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
  data: new AttachmentData({
    base64:
      'eyJzY2hlbWFfaWQiOiJhYWEiLCJjcmVkX2RlZl9pZCI6IlRoN01wVGFSWlZSWW5QaWFiZHM4MVk6MzpDTDoxNzpUQUciLCJub25jZSI6Im5vbmNlIiwia2V5X2NvcnJlY3RuZXNzX3Byb29mIjp7fX0',
  }),
});

const requestAttachment = new Attachment({
  id: '6526420d-8d1c-4f70-89de-54c9f3fa9f5c',
  mimeType: '',
  data: new AttachmentData({
    base64: JsonEncoder.toBase64(credReq),
  }),
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
  let repositoryFindMock: jest.Mock<Promise<CredentialRecord>, [string]>;
  let repositoryFindByQueryMock: jest.Mock<Promise<CredentialRecord[]>, [WalletQuery]>;

  beforeAll(async () => {
    wallet = new StubWallet();
    await wallet.init();
  });

  afterAll(async () => {
    await wallet.close();
    await wallet.delete();
  });

  beforeEach(() => {
    credentialRepository = new CredentialRepository();
    credentialService = new CredentialService(wallet, credentialRepository);

    // make separate repositoryFindMock variable to get the correct jest mock typing
    repositoryFindMock = credentialRepository.find as jest.Mock<Promise<CredentialRecord>, [string]>;

    // make separate repositoryFindByQueryMock variable to get the correct jest mock typing
    repositoryFindByQueryMock = credentialRepository.findByQuery as jest.Mock<
      Promise<CredentialRecord[]>,
      [WalletQuery]
    >;
  });

  describe('createCredentialOffer', () => {
    let credentialTemplate: CredentialOfferTemplate;

    beforeEach(() => {
      credentialTemplate = {
        credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
        comment: 'some comment',
        preview,
      };
    });

    test('creates credential record in OFFER_SENT state with offer, thread ID', async () => {
      // given
      const repositorySaveSpy = jest.spyOn(credentialRepository, 'save');

      // when
      const credentialOffer = await credentialService.createOffer(connection, credentialTemplate);

      // then
      expect(repositorySaveSpy).toHaveBeenCalledTimes(1);
      const [[createdCredentialRecord]] = repositorySaveSpy.mock.calls;
      expect(createdCredentialRecord).toMatchObject({
        type: CredentialRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Number),
        offer: credentialOffer,
        tags: { threadId: createdCredentialRecord.offer.id },
        state: 'OFFER_SENT',
      });
    });

    test(`emits stateChange event with a new credential in OFFER_SENT state`, async () => {
      const eventListenerMock = jest.fn();
      credentialService.on(EventType.StateChanged, eventListenerMock);

      await credentialService.createOffer(connection, credentialTemplate);

      expect(eventListenerMock).toHaveBeenCalledTimes(1);
      const [[event]] = eventListenerMock.mock.calls;
      expect(event).toMatchObject({
        prevState: null,
        credential: {
          state: 'OFFER_SENT',
        },
      });
    });

    test('returns credential offer message', async () => {
      const credentialOffer = await credentialService.createOffer(connection, credentialTemplate);

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
    let messageContext: InboundMessageContext<CredentialOfferMessage>;
    let credentialOfferMessage: CredentialOfferMessage;

    beforeEach(() => {
      credentialOfferMessage = new CredentialOfferMessage({
        comment: 'some comment',
        credentialPreview: preview,
        attachments: [attachment],
      });
      messageContext = new InboundMessageContext(credentialOfferMessage);
      messageContext.connection = connection;
    });

    test('creates and return credential record in OFFER_RECEIVED state with offer, thread ID', async () => {
      const repositorySaveSpy = jest.spyOn(credentialRepository, 'save');

      // when
      const returnedCredentialRecrod = await credentialService.processOffer(messageContext);

      // then
      const expectedCredentialRecord = {
        type: CredentialRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Number),
        offer: credentialOfferMessage,
        tags: { threadId: credentialOfferMessage.id },
        state: 'OFFER_RECEIVED',
      };
      expect(repositorySaveSpy).toHaveBeenCalledTimes(1);
      const [[createdCredentialRecord]] = repositorySaveSpy.mock.calls;
      expect(createdCredentialRecord).toMatchObject(expectedCredentialRecord);
      expect(returnedCredentialRecrod).toMatchObject(expectedCredentialRecord);
    });

    test(`emits stateChange event with OFFER_RECEIVED`, async () => {
      const eventListenerMock = jest.fn();
      credentialService.on(EventType.StateChanged, eventListenerMock);

      // when
      await credentialService.processOffer(messageContext);

      // then
      expect(eventListenerMock).toHaveBeenCalledTimes(1);
      const [[event]] = eventListenerMock.mock.calls;
      expect(event).toMatchObject({
        prevState: null,
        credential: {
          state: 'OFFER_RECEIVED',
        },
      });
    });
  });

  describe('createCredentialRequest', () => {
    let credentialRecord: CredentialRecord;

    beforeEach(() => {
      credentialRecord = mockCredentialRecord({
        state: CredentialState.OfferReceived,
        tags: { threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746' },
      });
    });

    test('updates state to REQUEST_SENT, set request metadata', async () => {
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update');

      // when
      await credentialService.createRequest(connection, credentialRecord, credDef);

      // then
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1);
      const [[updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls;
      expect(updatedCredentialRecord).toMatchObject({
        requestMetadata: { cred_req: 'meta-data' },
        state: 'REQUEST_SENT',
      });
    });

    test(`emits stateChange event with REQUEST_SENT`, async () => {
      const eventListenerMock = jest.fn();
      credentialService.on(EventType.StateChanged, eventListenerMock);

      // when
      await credentialService.createRequest(connection, credentialRecord, credDef);

      // then
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
      // given
      const comment = 'credential request comment';

      // when
      const credentialRequest = await credentialService.createRequest(connection, credentialRecord, credDef, {
        comment,
      });

      // then
      expect(credentialRequest.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'did:sov:BzCbsNYhMrjHiqZDTUASHg;spec/issue-credential/1.0/request-credential',
        '~thread': {
          thid: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        },
        comment,
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

    const validState = CredentialState.OfferReceived;
    const invalidCredentialStates = Object.values(CredentialState).filter(state => state !== validState);
    test(`throws an error when state transition is invalid`, async () => {
      await Promise.all(
        invalidCredentialStates.map(async state => {
          await expect(
            credentialService.createRequest(connection, mockCredentialRecord({ state }), credDef)
          ).rejects.toThrowError(`Credential record is in invalid state ${state}. Valid states are: ${validState}.`);
        })
      );
    });
  });

  describe('processCredentialRequest', () => {
    let credential: CredentialRecord;
    let messageContext: InboundMessageContext<CredentialRequestMessage>;

    beforeEach(() => {
      credential = mockCredentialRecord({ state: CredentialState.OfferSent });

      const credentialRequest = new CredentialRequestMessage({ comment: 'abcd', attachments: [requestAttachment] });
      credentialRequest.setThread({ threadId: 'somethreadid' });
      messageContext = new InboundMessageContext(credentialRequest);
    });

    test('updates state to REQUEST_RECEIVED, set request and returns credential record', async () => {
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update');

      // given
      repositoryFindByQueryMock.mockReturnValue(Promise.resolve([credential]));

      // when
      const returnedCredentialRecord = await credentialService.processRequest(messageContext);

      // then
      expect(repositoryFindByQueryMock).toHaveBeenCalledTimes(1);
      const [[findByQueryArg]] = repositoryFindByQueryMock.mock.calls;
      expect(findByQueryArg).toEqual({ threadId: 'somethreadid' });

      const expectedCredentialRecord = {
        state: 'REQUEST_RECEIVED',
        request: credReq,
      };
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1);
      const [[updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls;
      expect(updatedCredentialRecord).toMatchObject(expectedCredentialRecord);
      expect(returnedCredentialRecord).toMatchObject(expectedCredentialRecord);
    });

    test(`emits stateChange event from OFFER_SENT to REQUEST_RECEIVED`, async () => {
      const eventListenerMock = jest.fn();
      credentialService.on(EventType.StateChanged, eventListenerMock);
      repositoryFindByQueryMock.mockReturnValue(Promise.resolve([credential]));

      await credentialService.processRequest(messageContext);

      expect(eventListenerMock).toHaveBeenCalledTimes(1);
      const [[event]] = eventListenerMock.mock.calls;
      expect(event).toMatchObject({
        prevState: 'OFFER_SENT',
        credential: {
          state: 'REQUEST_RECEIVED',
        },
      });
    });

    const validState = CredentialState.OfferSent;
    const invalidCredentialStates = Object.values(CredentialState).filter(state => state !== validState);
    test(`throws an error when state transition is invalid`, async () => {
      await Promise.all(
        invalidCredentialStates.map(async state => {
          repositoryFindByQueryMock.mockReturnValue(Promise.resolve([mockCredentialRecord({ state })]));
          await expect(credentialService.processRequest(messageContext)).rejects.toThrowError(
            `Credential record is in invalid state ${state}. Valid states are: ${validState}.`
          );
        })
      );
    });
  });

  describe('createCredentialResponse', () => {
    const threadId = 'fd9c5ddb-ec11-4acd-bc32-540736249746';
    let credential: CredentialRecord;

    beforeEach(() => {
      credential = mockCredentialRecord({
        state: CredentialState.RequestReceived,
        request: credReq,
        tags: { threadId },
      });
    });

    test('updates state to CREDENTIAL_ISSUED', async () => {
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update');

      // given
      repositoryFindMock.mockReturnValue(Promise.resolve(credential));

      // when
      await credentialService.createResponse(credential.id);

      // then
      expect(repositoryFindMock).toHaveBeenCalledTimes(1);
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1);
      const [[updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls;
      expect(updatedCredentialRecord).toMatchObject({
        state: 'CREDENTIAL_ISSUED',
      });
    });

    test(`emits stateChange event from REQUEST_RECEIVED to CREDENTIAL_ISSUED`, async () => {
      const eventListenerMock = jest.fn();
      credentialService.on(EventType.StateChanged, eventListenerMock);

      // given
      repositoryFindMock.mockReturnValue(Promise.resolve(credential));

      // when
      await credentialService.createResponse(credential.id);

      // then
      expect(eventListenerMock).toHaveBeenCalledTimes(1);
      const [[event]] = eventListenerMock.mock.calls;
      expect(event).toMatchObject({
        prevState: 'REQUEST_RECEIVED',
        credential: {
          state: 'CREDENTIAL_ISSUED',
        },
      });
    });

    test('returns credential response message base on credential request message', async () => {
      // given
      repositoryFindMock.mockReturnValue(Promise.resolve(credential));
      const comment = 'credential response comment';

      // when
      const credentialResponse = await credentialService.createResponse(credential.id, { comment });

      // then
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(JsonEncoder.fromBase64(responseAttachment.data.base64!)).toEqual(cred);
    });

    test('throws error when credential record has no request', async () => {
      // given
      repositoryFindMock.mockReturnValue(Promise.resolve(mockCredentialRecord({ state: CredentialState.RequestSent })));

      // when, then
      await expect(credentialService.createResponse(credential.id)).rejects.toThrowError(
        'Credential does not contain request.'
      );
    });

    const validState = CredentialState.RequestReceived;
    const invalidCredentialStates = Object.values(CredentialState).filter(state => state !== validState);
    test(`throws an error when state transition is invalid`, async () => {
      await Promise.all(
        invalidCredentialStates.map(async state => {
          repositoryFindMock.mockReturnValue(
            Promise.resolve(mockCredentialRecord({ state, tags: { threadId }, request: credReq }))
          );
          await expect(credentialService.createResponse(credential.id)).rejects.toThrowError(
            `Credential record is in invalid state ${state}. Valid states are: ${validState}.`
          );
        })
      );
    });
  });

  describe('processCredentialResponse', () => {
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
    });

    test('finds credential record by thread ID and saves credential attachment into the wallet', async () => {
      const walletSaveSpy = jest.spyOn(wallet, 'storeCredential');

      // given
      repositoryFindByQueryMock.mockReturnValue(Promise.resolve([credential]));

      // when
      await credentialService.processResponse(messageContext, credDef);

      // then
      expect(repositoryFindByQueryMock).toHaveBeenCalledTimes(1);
      const [[findByQueryArg]] = repositoryFindByQueryMock.mock.calls;
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
    });

    test(`updates state to CREDENTIAL_RECEIVED, set credentialId and returns credential record`, async () => {
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update');

      // given
      repositoryFindByQueryMock.mockReturnValue(Promise.resolve([credential]));

      // when
      const updatedCredential = await credentialService.processResponse(messageContext, credDef);

      // then
      const expectedCredentialRecord = {
        credentialId: expect.any(String),
        state: 'CREDENTIAL_RECEIVED',
      };
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1);
      const [[updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls;
      expect(updatedCredentialRecord).toMatchObject(expectedCredentialRecord);
      expect(updatedCredential).toMatchObject(expectedCredentialRecord);
    });

    test(`emits stateChange event from REQUEST_SENT to CREDENTIAL_RECEIVED`, async () => {
      const eventListenerMock = jest.fn();
      credentialService.on(EventType.StateChanged, eventListenerMock);

      // given
      repositoryFindByQueryMock.mockReturnValue(Promise.resolve([credential]));

      // when
      await credentialService.processResponse(messageContext, credDef);

      // then
      expect(eventListenerMock).toHaveBeenCalledTimes(1);
      const [[event]] = eventListenerMock.mock.calls;
      expect(event).toMatchObject({
        prevState: 'REQUEST_SENT',
        credential: {
          state: 'CREDENTIAL_RECEIVED',
        },
      });
    });

    test('throws error when credential record has no request metadata', async () => {
      // given
      repositoryFindByQueryMock.mockReturnValue(
        Promise.resolve([mockCredentialRecord({ state: CredentialState.RequestSent })])
      );

      // when, then
      await expect(credentialService.processResponse(messageContext, credDef)).rejects.toThrowError(
        'Credential does not contain request metadata.'
      );
    });

    const validState = CredentialState.RequestSent;
    const invalidCredentialStates = Object.values(CredentialState).filter(state => state !== validState);
    test(`throws an error when state transition is invalid`, async () => {
      await Promise.all(
        invalidCredentialStates.map(async state => {
          repositoryFindByQueryMock.mockReturnValue(
            Promise.resolve([mockCredentialRecord({ state, requestMetadata: { cred_req: 'meta-data' } })])
          );
          await expect(credentialService.processResponse(messageContext, credDef)).rejects.toThrowError(
            `Credential record is in invalid state ${state}. Valid states are: ${validState}.`
          );
        })
      );
    });
  });

  describe('createAck', () => {
    const threadId = 'fd9c5ddb-ec11-4acd-bc32-540736249746';
    let credential: CredentialRecord;

    beforeEach(() => {
      credential = mockCredentialRecord({
        state: CredentialState.CredentialReceived,
        tags: { threadId },
      });
    });

    test('updates state to DONE', async () => {
      // given
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update');
      repositoryFindMock.mockReturnValue(Promise.resolve(credential));

      // when
      await credentialService.createAck(credential.id);

      // then
      expect(repositoryFindMock).toHaveBeenCalledTimes(1);
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

    const validState = CredentialState.CredentialReceived;
    const invalidCredentialStates = Object.values(CredentialState).filter(state => state !== validState);
    test(`throws an error when state transition is invalid`, async () => {
      await Promise.all(
        invalidCredentialStates.map(async state => {
          repositoryFindMock.mockReturnValue(Promise.resolve(mockCredentialRecord({ state, tags: { threadId } })));
          await expect(credentialService.createAck(credential.id)).rejects.toThrowError(
            `Credential record is in invalid state ${state}. Valid states are: ${validState}.`
          );
        })
      );
    });
  });

  describe('processAck', () => {
    let credential: CredentialRecord;
    let messageContext: InboundMessageContext<CredentialAckMessage>;

    beforeEach(() => {
      credential = mockCredentialRecord({ state: CredentialState.CredentialIssued });

      const credentialRequest = new CredentialAckMessage({});
      credentialRequest.setThread({ threadId: 'somethreadid' });
      messageContext = new InboundMessageContext(credentialRequest);
    });

    test('updates state to DONE and returns credential record', async () => {
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update');

      // given
      repositoryFindByQueryMock.mockReturnValue(Promise.resolve([credential]));

      // when
      const returnedCredentialRecord = await credentialService.processAck(messageContext);

      // then
      const expectedCredentialRecord = {
        state: 'DONE',
      };
      expect(repositoryFindByQueryMock).toHaveBeenCalledTimes(1);
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1);
      const [[updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls;
      expect(updatedCredentialRecord).toMatchObject(expectedCredentialRecord);
      expect(returnedCredentialRecord).toMatchObject(expectedCredentialRecord);
    });

    test(`emits stateChange event from CREDENTIAL_ISSUED to DONE`, async () => {
      const eventListenerMock = jest.fn();
      credentialService.on(EventType.StateChanged, eventListenerMock);

      // given
      repositoryFindByQueryMock.mockReturnValue(Promise.resolve([credential]));

      // when
      await credentialService.processAck(messageContext);

      // then
      expect(eventListenerMock).toHaveBeenCalledTimes(1);
      const [[event]] = eventListenerMock.mock.calls;
      expect(event).toMatchObject({
        prevState: 'CREDENTIAL_ISSUED',
        credential: {
          state: 'DONE',
        },
      });
    });

    test('throws error when there is no credential found by thread ID', async () => {
      // given
      repositoryFindByQueryMock.mockReturnValue(Promise.resolve([]));

      // when, then
      await expect(credentialService.processAck(messageContext)).rejects.toThrowError(
        'No credential found for threadId = somethreadid'
      );
    });

    const validState = CredentialState.CredentialIssued;
    const invalidCredentialStates = Object.values(CredentialState).filter(state => state !== validState);
    test(`throws an error when state transition is invalid`, async () => {
      await Promise.all(
        invalidCredentialStates.map(async state => {
          repositoryFindByQueryMock.mockReturnValue(Promise.resolve([mockCredentialRecord({ state })]));
          await expect(credentialService.processAck(messageContext)).rejects.toThrowError(
            `Credential record is in invalid state ${state}. Valid states are: ${validState}.`
          );
        })
      );
    });
  });
});
