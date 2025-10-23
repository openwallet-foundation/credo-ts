import { Subject } from 'rxjs'
import type { MockedClassConstructor } from '../../../../../../../../tests/types'
import type { AgentContext } from '../../../../../../../core/src/agent'
import { EventEmitter } from '../../../../../../../core/src/agent/EventEmitter'
import { JsonTransformer } from '../../../../../../../core/src/utils'
import {
  getAgentConfig,
  getAgentContext,
  getMockConnection,
  mockFunction,
} from '../../../../../../../core/tests/helpers'
import { DidCommDispatcher } from '../../../../../DidCommDispatcher'
import { DidCommAttachment, DidCommAttachmentData } from '../../../../../decorators/attachment/DidCommAttachment'
import { DidCommInboundMessageContext } from '../../../../../models'
import { DidCommMessageRepository } from '../../../../../repository'
import { DidCommConnectionService, DidCommDidExchangeState } from '../../../../connections'
import { DidCommRoutingService } from '../../../../routing/services/DidCommRoutingService'
import type { DidCommCredentialStateChangedEvent } from '../../../DidCommCredentialEvents'
import { DidCommCredentialEventTypes } from '../../../DidCommCredentialEvents'
import type {
  DidCommCredentialFormat,
  DidCommCredentialFormatCreateOfferOptions,
  DidCommCredentialFormatService,
} from '../../../formats'
import { DidCommCredentialFormatSpec } from '../../../models'
import { DidCommCredentialState } from '../../../models/DidCommCredentialState'
import { DidCommCredentialExchangeRecord } from '../../../repository/DidCommCredentialExchangeRecord'
import { DidCommCredentialExchangeRepository } from '../../../repository/DidCommCredentialExchangeRepository'
import type { CreateCredentialOfferOptions } from '../../DidCommCredentialProtocolOptions'
import { DidCommCredentialV2Protocol } from '../DidCommCredentialV2Protocol'
import { DidCommCredentialV2Preview } from '../messages'
import { DidCommOfferCredentialV2Message } from '../messages/DidCommOfferCredentialV2Message'

const offerFormat = new DidCommCredentialFormatSpec({
  attachmentId: 'offer-attachment-id',
  format: 'hlindy/cred-abstract@v2.0',
})

const offerAttachment = new DidCommAttachment({
  id: 'offer-attachment-id',
  mimeType: 'application/json',
  data: new DidCommAttachmentData({
    base64:
      'eyJzY2hlbWFfaWQiOiJhYWEiLCJjcmVkX2RlZl9pZCI6IlRoN01wVGFSWlZSWW5QaWFiZHM4MVk6MzpDTDoxNzpUQUciLCJub25jZSI6Im5vbmNlIiwia2V5X2NvcnJlY3RuZXNzX3Byb29mIjp7fX0',
  }),
})

interface TestCredentialFormat extends DidCommCredentialFormat {
  formatKey: 'test'
  credentialRecordType: 'test'
}

type TestCredentialFormatService = DidCommCredentialFormatService<TestCredentialFormat>

export const testCredentialFormatService = {
  credentialRecordType: 'test',
  formatKey: 'test',
  supportsFormat: (_format: string) => true,
  createOffer: async (
    _agentContext: AgentContext,
    _options: DidCommCredentialFormatCreateOfferOptions<TestCredentialFormat>
  ) => ({
    attachment: offerAttachment,
    format: offerFormat,
    previewAttributes: [
      {
        mimeType: 'text/plain',
        name: 'name',
        value: 'John',
      },
      {
        mimeType: 'text/plain',
        name: 'age',
        value: '99',
      },
    ],
  }),
  acceptRequest: vi.fn(),
  deleteCredentialById: vi.fn(),
  processCredential: vi.fn(),
  acceptOffer: vi.fn(),
  processRequest: vi.fn(),
  processOffer: vi.fn(),
} as unknown as TestCredentialFormatService

// Mock classes
vi.mock('../../../repository/DidCommCredentialExchangeRepository')
vi.mock('../../../../../repository/DidCommMessageRepository')
vi.mock('../../../../routing/services/DidCommRoutingService')
vi.mock('../../../../connections/services/DidCommConnectionService')
vi.mock('../../../../../DidCommDispatcher')

// Mock typed object
const CredentialRepositoryMock = DidCommCredentialExchangeRepository as MockedClassConstructor<
  typeof DidCommCredentialExchangeRepository
>
const DidCommMessageRepositoryMock = DidCommMessageRepository as MockedClassConstructor<typeof DidCommMessageRepository>
const RoutingServiceMock = DidCommRoutingService as MockedClassConstructor<typeof DidCommRoutingService>
const ConnectionServiceMock = DidCommConnectionService as MockedClassConstructor<typeof DidCommConnectionService>
const DispatcherMock = DidCommDispatcher as MockedClassConstructor<typeof DidCommDispatcher>

const credentialRepository = new CredentialRepositoryMock()
const didCommMessageRepository = new DidCommMessageRepositoryMock()
const routingService = new RoutingServiceMock()
const dispatcher = new DispatcherMock()
const connectionService = new ConnectionServiceMock()

const agentConfig = getAgentConfig('V2CredentialProtocolOfferTest')
const eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())

const agentContext = getAgentContext({
  registerInstances: [
    [DidCommCredentialExchangeRepository, credentialRepository],
    [DidCommMessageRepository, didCommMessageRepository],
    [DidCommRoutingService, routingService],
    [DidCommDispatcher, dispatcher],
    [DidCommConnectionService, connectionService],
    [EventEmitter, eventEmitter],
  ],
  agentConfig,
})

const connectionRecord = getMockConnection({
  id: '123',
  state: DidCommDidExchangeState.Completed,
})

describe('V2CredentialProtocolOffer', () => {
  let credentialProtocol: DidCommCredentialV2Protocol

  beforeEach(async () => {
    // mock function implementations
    mockFunction(connectionService.getById).mockResolvedValue(connectionRecord)

    credentialProtocol = new DidCommCredentialV2Protocol({
      credentialFormats: [testCredentialFormatService],
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('createOffer', () => {
    const offerOptions: CreateCredentialOfferOptions<[TestCredentialFormatService]> = {
      comment: 'some comment',
      connectionRecord,
      credentialFormats: {
        test: {},
      },
    }

    test(`creates credential record in ${DidCommCredentialState.OfferSent} state with offer, thread ID`, async () => {
      // when
      await credentialProtocol.createOffer(agentContext, offerOptions)

      // then
      expect(credentialRepository.save).toHaveBeenNthCalledWith(
        1,
        agentContext,
        expect.objectContaining({
          type: DidCommCredentialExchangeRecord.type,
          id: expect.any(String),
          createdAt: expect.any(Date),
          state: DidCommCredentialState.OfferSent,
          connectionId: connectionRecord.id,
        })
      )
    })

    test(`emits stateChange event with a new credential in ${DidCommCredentialState.OfferSent} state`, async () => {
      const eventListenerMock = vi.fn()
      eventEmitter.on<DidCommCredentialStateChangedEvent>(
        DidCommCredentialEventTypes.DidCommCredentialStateChanged,
        eventListenerMock
      )

      await credentialProtocol.createOffer(agentContext, offerOptions)

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'DidCommCredentialStateChanged',
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          previousState: null,
          credentialExchangeRecord: expect.objectContaining({
            state: DidCommCredentialState.OfferSent,
          }),
        },
      })
    })

    test('returns credential offer message', async () => {
      const { message: credentialOffer } = await credentialProtocol.createOffer(agentContext, offerOptions)

      expect(credentialOffer.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/2.0/offer-credential',
        comment: 'some comment',
        credential_preview: {
          '@type': 'https://didcomm.org/issue-credential/2.0/credential-preview',
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
        formats: [JsonTransformer.toJSON(offerFormat)],
        'offers~attach': [JsonTransformer.toJSON(offerAttachment)],
      })
    })
  })

  describe('processOffer', () => {
    const credentialOfferMessage = new DidCommOfferCredentialV2Message({
      formats: [offerFormat],
      comment: 'some comment',
      credentialPreview: new DidCommCredentialV2Preview({
        attributes: [],
      }),
      offerAttachments: [offerAttachment],
    })

    const messageContext = new DidCommInboundMessageContext(credentialOfferMessage, {
      agentContext,
      connection: connectionRecord,
    })

    test(`creates and return credential record in ${DidCommCredentialState.OfferReceived} state with offer, thread ID`, async () => {
      // when
      await credentialProtocol.processOffer(messageContext)

      // then
      expect(credentialRepository.save).toHaveBeenNthCalledWith(
        1,
        agentContext,
        expect.objectContaining({
          type: DidCommCredentialExchangeRecord.type,
          id: expect.any(String),
          createdAt: expect.any(Date),
          threadId: credentialOfferMessage.id,
          connectionId: connectionRecord.id,
          state: DidCommCredentialState.OfferReceived,
        })
      )
    })

    test(`emits stateChange event with ${DidCommCredentialState.OfferReceived}`, async () => {
      const eventListenerMock = vi.fn()
      eventEmitter.on<DidCommCredentialStateChangedEvent>(
        DidCommCredentialEventTypes.DidCommCredentialStateChanged,
        eventListenerMock
      )

      // when
      await credentialProtocol.processOffer(messageContext)

      // then
      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'DidCommCredentialStateChanged',
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          previousState: null,
          credentialExchangeRecord: expect.objectContaining({
            state: DidCommCredentialState.OfferReceived,
          }),
        },
      })
    })
  })
})
