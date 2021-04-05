/* eslint-disable no-console */
import type Indy from 'indy-sdk'
import type { CredReqMetadata, WalletQuery, CredDef } from 'indy-sdk'
import { Wallet } from '../../../wallet/Wallet'
import { Repository } from '../../../storage/Repository'
import { CredentialOfferTemplate, CredentialService, CredentialEventType } from '../services'
import { CredentialRecord } from '../repository/CredentialRecord'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { CredentialState } from '../CredentialState'
import { StubWallet } from './StubWallet'
import {
  OfferCredentialMessage,
  CredentialPreview,
  CredentialPreviewAttribute,
  RequestCredentialMessage,
  IssueCredentialMessage,
  CredentialAckMessage,
  INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
  INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
  INDY_CREDENTIAL_ATTACHMENT_ID,
} from '../messages'
import { AckStatus } from '../../common'
import { JsonEncoder } from '../../../utils/JsonEncoder'
import { credDef, credOffer, credReq } from './fixtures'
import { Attachment, AttachmentData } from '../../../decorators/attachment/Attachment'
import { LedgerService as LedgerServiceImpl } from '../../ledger/services'
import { ConnectionState } from '../../connections'
import { getMockConnection } from '../../connections/__tests__/ConnectionService.test'
import { AgentConfig } from '../../../agent/AgentConfig'

jest.mock('./../../../storage/Repository')
jest.mock('./../../../modules/ledger/services/LedgerService')

const indy = {} as typeof Indy

const CredentialRepository = <jest.Mock<Repository<CredentialRecord>>>(<unknown>Repository)
// const ConnectionService = <jest.Mock<ConnectionServiceImpl>>(<unknown>ConnectionServiceImpl);
const LedgerService = <jest.Mock<LedgerServiceImpl>>(<unknown>LedgerServiceImpl)

const connection = getMockConnection({
  id: '123',
  state: ConnectionState.Complete,
})

const credentialPreview = new CredentialPreview({
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
})

const offerAttachment = new Attachment({
  id: INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
  mimeType: 'application/json',
  data: new AttachmentData({
    base64:
      'eyJzY2hlbWFfaWQiOiJhYWEiLCJjcmVkX2RlZl9pZCI6IlRoN01wVGFSWlZSWW5QaWFiZHM4MVk6MzpDTDoxNzpUQUciLCJub25jZSI6Im5vbmNlIiwia2V5X2NvcnJlY3RuZXNzX3Byb29mIjp7fX0',
  }),
})

const requestAttachment = new Attachment({
  id: INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
  mimeType: 'application/json',
  data: new AttachmentData({
    base64: JsonEncoder.toBase64(credReq),
  }),
})

// TODO: replace attachment with credential fixture
const credentialAttachment = new Attachment({
  id: INDY_CREDENTIAL_ATTACHMENT_ID,
  mimeType: 'application/json',
  data: new AttachmentData({
    base64: JsonEncoder.toBase64(credReq),
  }),
})

// A record is deserialized to JSON when it's stored into the storage. We want to simulate this behaviour for `offer`
// object to test our service would behave correctly. We use type assertion for `offer` attribute to `any`.
const mockCredentialRecord = ({
  state,
  requestMessage,
  requestMetadata,
  tags,
  id,
}: {
  state: CredentialState
  requestMessage?: RequestCredentialMessage
  requestMetadata?: CredReqMetadata
  tags?: Record<string, unknown>
  id?: string
}) =>
  new CredentialRecord({
    offerMessage: new OfferCredentialMessage({
      comment: 'some comment',
      credentialPreview: credentialPreview,
      attachments: [offerAttachment],
    }).toJSON(),
    id,
    requestMessage,
    requestMetadata: requestMetadata,
    state: state || CredentialState.OfferSent,
    tags: tags || {},
    connectionId: '123',
  } as any)

describe('CredentialService', () => {
  let wallet: Wallet
  let credentialRepository: Repository<CredentialRecord>
  let credentialService: CredentialService
  let ledgerService: LedgerServiceImpl
  let repositoryFindMock: jest.Mock<Promise<CredentialRecord>, [string]>
  let repositoryFindByQueryMock: jest.Mock<Promise<CredentialRecord[]>, [WalletQuery]>
  let ledgerServiceGetCredDef: jest.Mock<Promise<CredDef>, [string]>

  beforeAll(async () => {
    wallet = new StubWallet()
    await wallet.init()
  })

  afterAll(async () => {
    await wallet.close()
    await wallet.delete()
  })

  beforeEach(() => {
    credentialRepository = new CredentialRepository()
    // connectionService = new ConnectionService();
    ledgerService = new LedgerService()

    credentialService = new CredentialService(
      wallet,
      credentialRepository,
      { getById: () => Promise.resolve(connection) } as any,
      ledgerService,
      new AgentConfig({
        walletConfig: { id: 'test' },
        walletCredentials: { key: 'test' },
        indy,
        label: 'test',
      })
    )

    // make separate repositoryFindMock variable to get the correct jest mock typing
    repositoryFindMock = credentialRepository.find as jest.Mock<Promise<CredentialRecord>, [string]>

    // make separate repositoryFindByQueryMock variable to get the correct jest mock typing
    repositoryFindByQueryMock = credentialRepository.findByQuery as jest.Mock<
      Promise<CredentialRecord[]>,
      [WalletQuery]
    >

    ledgerServiceGetCredDef = ledgerService.getCredentialDefinition as jest.Mock<Promise<CredDef>, [string]>
    ledgerServiceGetCredDef.mockReturnValue(Promise.resolve(credDef))
  })

  describe('createCredentialOffer', () => {
    let credentialTemplate: CredentialOfferTemplate

    beforeEach(() => {
      credentialTemplate = {
        credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
        comment: 'some comment',
        preview: credentialPreview,
      }
    })

    test(`creates credential record in ${CredentialState.OfferSent} state with offer, thread ID`, async () => {
      // given
      const repositorySaveSpy = jest.spyOn(credentialRepository, 'save')

      // when
      const { message: credentialOffer } = await credentialService.createOffer(connection, credentialTemplate)

      // then
      expect(repositorySaveSpy).toHaveBeenCalledTimes(1)
      const [[createdCredentialRecord]] = repositorySaveSpy.mock.calls
      expect(createdCredentialRecord).toMatchObject({
        type: CredentialRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Number),
        offerMessage: credentialOffer,
        tags: { threadId: createdCredentialRecord.offerMessage?.id },
        state: CredentialState.OfferSent,
      })
    })

    test(`emits stateChange event with a new credential in ${CredentialState.OfferSent} state`, async () => {
      const eventListenerMock = jest.fn()
      credentialService.on(CredentialEventType.StateChanged, eventListenerMock)

      await credentialService.createOffer(connection, credentialTemplate)

      expect(eventListenerMock).toHaveBeenCalledTimes(1)
      const [[event]] = eventListenerMock.mock.calls
      expect(event).toMatchObject({
        previousState: null,
        credentialRecord: {
          state: CredentialState.OfferSent,
        },
      })
    })

    test('returns credential offer message', async () => {
      const { message: credentialOffer } = await credentialService.createOffer(connection, credentialTemplate)

      expect(credentialOffer.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/1.0/offer-credential',
        comment: 'some comment',
        credential_preview: {
          '@type': 'https://didcomm.org/issue-credential/1.0/credential-preview',
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
      })
    })
  })

  describe('processCredentialOffer', () => {
    let messageContext: InboundMessageContext<OfferCredentialMessage>
    let credentialOfferMessage: OfferCredentialMessage

    beforeEach(() => {
      credentialOfferMessage = new OfferCredentialMessage({
        comment: 'some comment',
        credentialPreview: credentialPreview,
        attachments: [offerAttachment],
      })
      messageContext = new InboundMessageContext(credentialOfferMessage, {
        connection,
      })
      messageContext.connection = connection
    })

    test(`creates and return credential record in ${CredentialState.OfferReceived} state with offer, thread ID`, async () => {
      const repositorySaveSpy = jest.spyOn(credentialRepository, 'save')

      // when
      const returnedCredentialRecord = await credentialService.processOffer(messageContext)

      // then
      const expectedCredentialRecord = {
        type: CredentialRecord.name,
        id: expect.any(String),
        createdAt: expect.any(Number),
        offerMessage: credentialOfferMessage,
        tags: { threadId: credentialOfferMessage.id },
        state: CredentialState.OfferReceived,
      }
      expect(repositorySaveSpy).toHaveBeenCalledTimes(1)
      const [[createdCredentialRecord]] = repositorySaveSpy.mock.calls
      expect(createdCredentialRecord).toMatchObject(expectedCredentialRecord)
      expect(returnedCredentialRecord).toMatchObject(expectedCredentialRecord)
    })

    test(`emits stateChange event with ${CredentialState.OfferReceived}`, async () => {
      const eventListenerMock = jest.fn()
      credentialService.on(CredentialEventType.StateChanged, eventListenerMock)

      // when
      await credentialService.processOffer(messageContext)

      // then
      expect(eventListenerMock).toHaveBeenCalledTimes(1)
      const [[event]] = eventListenerMock.mock.calls
      expect(event).toMatchObject({
        previousState: null,
        credentialRecord: {
          state: CredentialState.OfferReceived,
        },
      })
    })
  })

  describe('createCredentialRequest', () => {
    let credentialRecord: CredentialRecord

    beforeEach(() => {
      credentialRecord = mockCredentialRecord({
        state: CredentialState.OfferReceived,
        tags: { threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746' },
      })
    })

    test(`updates state to ${CredentialState.RequestSent}, set request metadata`, async () => {
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update')

      // when
      await credentialService.createRequest(credentialRecord)

      // then
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1)
      const [[updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls
      expect(updatedCredentialRecord).toMatchObject({
        requestMetadata: { cred_req: 'meta-data' },
        state: CredentialState.RequestSent,
      })
    })

    test(`emits stateChange event with ${CredentialState.RequestSent}`, async () => {
      const eventListenerMock = jest.fn()
      credentialService.on(CredentialEventType.StateChanged, eventListenerMock)

      // when
      await credentialService.createRequest(credentialRecord)

      // then
      expect(eventListenerMock).toHaveBeenCalledTimes(1)
      const [[event]] = eventListenerMock.mock.calls
      expect(event).toMatchObject({
        previousState: CredentialState.OfferReceived,
        credentialRecord: {
          state: CredentialState.RequestSent,
        },
      })
    })

    test('returns credential request message base on existing credential offer message', async () => {
      // given
      const comment = 'credential request comment'

      // when
      const { message: credentialRequest } = await credentialService.createRequest(credentialRecord, {
        comment,
      })

      // then
      expect(credentialRequest.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/1.0/request-credential',
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
      })
    })

    const validState = CredentialState.OfferReceived
    const invalidCredentialStates = Object.values(CredentialState).filter((state) => state !== validState)
    test(`throws an error when state transition is invalid`, async () => {
      await Promise.all(
        invalidCredentialStates.map(async (state) => {
          await expect(credentialService.createRequest(mockCredentialRecord({ state }))).rejects.toThrowError(
            `Credential record is in invalid state ${state}. Valid states are: ${validState}.`
          )
        })
      )
    })
  })

  describe('processCredentialRequest', () => {
    let credential: CredentialRecord
    let messageContext: InboundMessageContext<RequestCredentialMessage>

    beforeEach(() => {
      credential = mockCredentialRecord({ state: CredentialState.OfferSent })

      const credentialRequest = new RequestCredentialMessage({
        comment: 'abcd',
        attachments: [requestAttachment],
      })
      credentialRequest.setThread({ threadId: 'somethreadid' })
      messageContext = new InboundMessageContext(credentialRequest, {
        connection,
      })
    })

    test(`updates state to ${CredentialState.RequestReceived}, set request and returns credential record`, async () => {
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update')

      // given
      repositoryFindByQueryMock.mockReturnValue(Promise.resolve([credential]))

      // when
      const returnedCredentialRecord = await credentialService.processRequest(messageContext)

      // then
      expect(repositoryFindByQueryMock).toHaveBeenCalledTimes(1)
      const [[findByQueryArg]] = repositoryFindByQueryMock.mock.calls
      expect(findByQueryArg).toEqual({ threadId: 'somethreadid' })

      const expectedCredentialRecord = {
        state: CredentialState.RequestReceived,
        requestMessage: messageContext.message,
      }
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1)
      const [[updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls
      expect(updatedCredentialRecord).toMatchObject(expectedCredentialRecord)
      expect(returnedCredentialRecord).toMatchObject(expectedCredentialRecord)
    })

    test(`emits stateChange event from ${CredentialState.OfferSent} to ${CredentialState.RequestReceived}`, async () => {
      const eventListenerMock = jest.fn()
      credentialService.on(CredentialEventType.StateChanged, eventListenerMock)
      repositoryFindByQueryMock.mockReturnValue(Promise.resolve([credential]))

      await credentialService.processRequest(messageContext)

      expect(eventListenerMock).toHaveBeenCalledTimes(1)
      const [[event]] = eventListenerMock.mock.calls
      expect(event).toMatchObject({
        previousState: CredentialState.OfferSent,
        credentialRecord: {
          state: CredentialState.RequestReceived,
        },
      })
    })

    const validState = CredentialState.OfferSent
    const invalidCredentialStates = Object.values(CredentialState).filter((state) => state !== validState)
    test(`throws an error when state transition is invalid`, async () => {
      await Promise.all(
        invalidCredentialStates.map(async (state) => {
          repositoryFindByQueryMock.mockReturnValue(Promise.resolve([mockCredentialRecord({ state })]))
          await expect(credentialService.processRequest(messageContext)).rejects.toThrowError(
            `Credential record is in invalid state ${state}. Valid states are: ${validState}.`
          )
        })
      )
    })
  })

  describe('createCredential', () => {
    const threadId = 'fd9c5ddb-ec11-4acd-bc32-540736249746'
    let credential: CredentialRecord

    beforeEach(() => {
      credential = mockCredentialRecord({
        state: CredentialState.RequestReceived,
        requestMessage: new RequestCredentialMessage({
          comment: 'abcd',
          attachments: [requestAttachment],
        }),
        tags: { threadId },
      })
    })

    test(`updates state to ${CredentialState.CredentialIssued}`, async () => {
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update')

      // when
      await credentialService.createCredential(credential)

      // then
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1)
      const [[updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls
      expect(updatedCredentialRecord).toMatchObject({
        state: CredentialState.CredentialIssued,
      })
    })

    test(`emits stateChange event from ${CredentialState.RequestReceived} to ${CredentialState.CredentialIssued}`, async () => {
      const eventListenerMock = jest.fn()
      credentialService.on(CredentialEventType.StateChanged, eventListenerMock)

      // given
      repositoryFindMock.mockReturnValue(Promise.resolve(credential))

      // when
      await credentialService.createCredential(credential)

      // then
      expect(eventListenerMock).toHaveBeenCalledTimes(1)
      const [[event]] = eventListenerMock.mock.calls
      expect(event).toMatchObject({
        previousState: CredentialState.RequestReceived,
        credentialRecord: {
          state: CredentialState.CredentialIssued,
        },
      })
    })

    test('returns credential response message base on credential request message', async () => {
      // given
      repositoryFindMock.mockReturnValue(Promise.resolve(credential))
      const comment = 'credential response comment'

      // when
      const { message: credentialResponse } = await credentialService.createCredential(credential, { comment })

      // then
      expect(credentialResponse.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/1.0/issue-credential',
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
      })

      // We're using instance of `StubWallet`. Value of `cred` should be as same as in the credential response message.
      const [cred] = await wallet.createCredential(credOffer, credReq, {})
      const [responseAttachment] = credentialResponse.attachments
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(JsonEncoder.fromBase64(responseAttachment.data.base64!)).toEqual(cred)
    })

    test('throws error when credential record has no request', async () => {
      // when, then
      await expect(
        credentialService.createCredential(
          mockCredentialRecord({
            state: CredentialState.RequestReceived,
            tags: { threadId },
          })
        )
      ).rejects.toThrowError(
        `Missing required base64 encoded attachment data for credential request with thread id ${threadId}`
      )
    })

    const validState = CredentialState.RequestReceived
    const invalidCredentialStates = Object.values(CredentialState).filter((state) => state !== validState)
    test(`throws an error when state transition is invalid`, async () => {
      await Promise.all(
        invalidCredentialStates.map(async (state) => {
          await expect(
            credentialService.createCredential(
              mockCredentialRecord({
                state,
                tags: { threadId },
                requestMessage: new RequestCredentialMessage({
                  attachments: [requestAttachment],
                }),
              })
            )
          ).rejects.toThrowError(`Credential record is in invalid state ${state}. Valid states are: ${validState}.`)
        })
      )
    })
  })

  describe('processCredential', () => {
    let credential: CredentialRecord
    let messageContext: InboundMessageContext<IssueCredentialMessage>

    beforeEach(() => {
      credential = mockCredentialRecord({
        state: CredentialState.RequestSent,
        requestMessage: new RequestCredentialMessage({
          attachments: [requestAttachment],
        }),
        requestMetadata: { cred_req: 'meta-data' },
      })

      const credentialResponse = new IssueCredentialMessage({
        comment: 'abcd',
        attachments: [credentialAttachment],
      })
      credentialResponse.setThread({ threadId: 'somethreadid' })
      messageContext = new InboundMessageContext(credentialResponse, {
        connection,
      })
    })

    test('finds credential record by thread ID and saves credential attachment into the wallet', async () => {
      const walletSaveSpy = jest.spyOn(wallet, 'storeCredential')

      // given
      repositoryFindByQueryMock.mockReturnValue(Promise.resolve([credential]))

      // when
      await credentialService.processCredential(messageContext)

      // then
      expect(repositoryFindByQueryMock).toHaveBeenCalledTimes(1)
      const [[findByQueryArg]] = repositoryFindByQueryMock.mock.calls
      expect(findByQueryArg).toEqual({ threadId: 'somethreadid' })

      expect(walletSaveSpy).toHaveBeenCalledTimes(1)
      const [[...walletSaveArgs]] = walletSaveSpy.mock.calls
      expect(walletSaveArgs).toEqual(
        expect.arrayContaining([
          expect.any(String),
          { cred_req: 'meta-data' },
          messageContext.message.indyCredential,
          credDef,
        ])
      )
    })

    test(`updates state to ${CredentialState.CredentialReceived}, set credentialId and returns credential record`, async () => {
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update')

      // given
      repositoryFindByQueryMock.mockReturnValue(Promise.resolve([credential]))

      // when
      const updatedCredential = await credentialService.processCredential(messageContext)

      // then
      const expectedCredentialRecord = {
        credentialId: expect.any(String),
        state: CredentialState.CredentialReceived,
      }
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1)
      const [[updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls
      expect(updatedCredentialRecord).toMatchObject(expectedCredentialRecord)
      expect(updatedCredential).toMatchObject(expectedCredentialRecord)
    })

    test(`emits stateChange event from ${CredentialState.RequestSent} to ${CredentialState.CredentialReceived}`, async () => {
      const eventListenerMock = jest.fn()
      credentialService.on(CredentialEventType.StateChanged, eventListenerMock)

      // given
      repositoryFindByQueryMock.mockReturnValue(Promise.resolve([credential]))

      // when
      await credentialService.processCredential(messageContext)

      // then
      expect(eventListenerMock).toHaveBeenCalledTimes(1)
      const [[event]] = eventListenerMock.mock.calls
      expect(event).toMatchObject({
        previousState: CredentialState.RequestSent,
        credentialRecord: {
          state: CredentialState.CredentialReceived,
        },
      })
    })

    test('throws error when credential record has no request metadata', async () => {
      // given
      repositoryFindByQueryMock.mockReturnValue(
        Promise.resolve([
          mockCredentialRecord({
            state: CredentialState.RequestSent,
            id: 'id',
          }),
        ])
      )

      // when, then
      await expect(credentialService.processCredential(messageContext)).rejects.toThrowError(
        `Missing required request metadata for credential with id id`
      )
    })

    const validState = CredentialState.RequestSent
    const invalidCredentialStates = Object.values(CredentialState).filter((state) => state !== validState)
    test(`throws an error when state transition is invalid`, async () => {
      await Promise.all(
        invalidCredentialStates.map(async (state) => {
          repositoryFindByQueryMock.mockReturnValue(
            Promise.resolve([
              mockCredentialRecord({
                state,
                requestMetadata: { cred_req: 'meta-data' },
              }),
            ])
          )
          await expect(credentialService.processCredential(messageContext)).rejects.toThrowError(
            `Credential record is in invalid state ${state}. Valid states are: ${validState}.`
          )
        })
      )
    })
  })

  describe('createAck', () => {
    const threadId = 'fd9c5ddb-ec11-4acd-bc32-540736249746'
    let credential: CredentialRecord

    beforeEach(() => {
      credential = mockCredentialRecord({
        state: CredentialState.CredentialReceived,
        tags: { threadId },
      })
    })

    test(`updates state to ${CredentialState.Done}`, async () => {
      // given
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update')

      // when
      await credentialService.createAck(credential)

      // then
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1)
      const [[updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls
      expect(updatedCredentialRecord).toMatchObject({
        state: CredentialState.Done,
      })
    })

    test(`emits stateChange event from ${CredentialState.CredentialReceived} to ${CredentialState.Done}`, async () => {
      const eventListenerMock = jest.fn()
      credentialService.on(CredentialEventType.StateChanged, eventListenerMock)

      // given
      repositoryFindMock.mockReturnValue(Promise.resolve(credential))

      // when
      await credentialService.createAck(credential)

      // then
      expect(eventListenerMock).toHaveBeenCalledTimes(1)
      const [[event]] = eventListenerMock.mock.calls
      expect(event).toMatchObject({
        previousState: CredentialState.CredentialReceived,
        credentialRecord: {
          state: CredentialState.Done,
        },
      })
    })

    test('returns credential response message base on credential request message', async () => {
      // given
      repositoryFindMock.mockReturnValue(Promise.resolve(credential))

      // when
      const { message: ackMessage } = await credentialService.createAck(credential)

      // then
      expect(ackMessage.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/1.0/ack',
        '~thread': {
          thid: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        },
      })
    })

    const validState = CredentialState.CredentialReceived
    const invalidCredentialStates = Object.values(CredentialState).filter((state) => state !== validState)
    test(`throws an error when state transition is invalid`, async () => {
      await Promise.all(
        invalidCredentialStates.map(async (state) => {
          await expect(
            credentialService.createAck(mockCredentialRecord({ state, tags: { threadId } }))
          ).rejects.toThrowError(`Credential record is in invalid state ${state}. Valid states are: ${validState}.`)
        })
      )
    })
  })

  describe('processAck', () => {
    let credential: CredentialRecord
    let messageContext: InboundMessageContext<CredentialAckMessage>

    beforeEach(() => {
      credential = mockCredentialRecord({
        state: CredentialState.CredentialIssued,
      })

      const credentialRequest = new CredentialAckMessage({
        status: AckStatus.OK,
        threadId: 'somethreadid',
      })
      messageContext = new InboundMessageContext(credentialRequest, {
        connection,
      })
    })

    test(`updates state to ${CredentialState.Done} and returns credential record`, async () => {
      const repositoryUpdateSpy = jest.spyOn(credentialRepository, 'update')

      // given
      repositoryFindByQueryMock.mockReturnValue(Promise.resolve([credential]))

      // when
      const returnedCredentialRecord = await credentialService.processAck(messageContext)

      // then
      const expectedCredentialRecord = {
        state: CredentialState.Done,
      }
      expect(repositoryFindByQueryMock).toHaveBeenCalledTimes(1)
      expect(repositoryUpdateSpy).toHaveBeenCalledTimes(1)
      const [[updatedCredentialRecord]] = repositoryUpdateSpy.mock.calls
      expect(updatedCredentialRecord).toMatchObject(expectedCredentialRecord)
      expect(returnedCredentialRecord).toMatchObject(expectedCredentialRecord)
    })

    test(`emits stateChange event from ${CredentialState.CredentialIssued} to ${CredentialState.Done}`, async () => {
      const eventListenerMock = jest.fn()
      credentialService.on(CredentialEventType.StateChanged, eventListenerMock)

      // given
      repositoryFindByQueryMock.mockReturnValue(Promise.resolve([credential]))

      // when
      await credentialService.processAck(messageContext)

      // then
      expect(eventListenerMock).toHaveBeenCalledTimes(1)
      const [[event]] = eventListenerMock.mock.calls
      expect(event).toMatchObject({
        previousState: CredentialState.CredentialIssued,
        credentialRecord: {
          state: CredentialState.Done,
        },
      })
    })

    test('throws error when there is no credential found by thread ID', async () => {
      // given
      repositoryFindByQueryMock.mockReturnValue(Promise.resolve([]))

      // when, then
      await expect(credentialService.processAck(messageContext)).rejects.toThrowError(
        'Credential record not found by thread id somethreadid'
      )
    })

    const validState = CredentialState.CredentialIssued
    const invalidCredentialStates = Object.values(CredentialState).filter((state) => state !== validState)
    test(`throws an error when state transition is invalid`, async () => {
      await Promise.all(
        invalidCredentialStates.map(async (state) => {
          repositoryFindByQueryMock.mockReturnValue(Promise.resolve([mockCredentialRecord({ state })]))
          await expect(credentialService.processAck(messageContext)).rejects.toThrowError(
            `Credential record is in invalid state ${state}. Valid states are: ${validState}.`
          )
        })
      )
    })
  })
})
