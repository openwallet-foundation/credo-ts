import type { CredentialStateChangedEvent } from '../../../CredentialEvents'
import type { CreateOfferOptions } from '../../../CredentialServiceOptions'
import type { IndyCredentialFormat } from '../../../formats/indy/IndyCredentialFormat'

import { Subject } from 'rxjs'

import { getAgentConfig, getAgentContext, getMockConnection, mockFunction } from '../../../../../../tests/helpers'
import { Dispatcher } from '../../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../../agent/EventEmitter'
import { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import { Attachment, AttachmentData } from '../../../../../decorators/attachment/Attachment'
import { DidCommMessageRepository } from '../../../../../storage'
import { JsonTransformer } from '../../../../../utils'
import { DidExchangeState } from '../../../../connections'
import { ConnectionService } from '../../../../connections/services/ConnectionService'
import { IndyLedgerService } from '../../../../ledger/services'
import { RoutingService } from '../../../../routing/services/RoutingService'
import { CredentialEventTypes } from '../../../CredentialEvents'
import { credDef, schema } from '../../../__tests__/fixtures'
import { IndyCredentialFormatService } from '../../../formats/indy/IndyCredentialFormatService'
import { CredentialFormatSpec } from '../../../models'
import { CredentialState } from '../../../models/CredentialState'
import { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import { CredentialRepository } from '../../../repository/CredentialRepository'
import { V1CredentialPreview } from '../../v1/messages/V1CredentialPreview'
import { V2CredentialService } from '../V2CredentialService'
import { V2OfferCredentialMessage } from '../messages/V2OfferCredentialMessage'

// Mock classes
jest.mock('../../../repository/CredentialRepository')
jest.mock('../../../../ledger/services/IndyLedgerService')
jest.mock('../../../formats/indy/IndyCredentialFormatService')
jest.mock('../../../../../storage/didcomm/DidCommMessageRepository')
jest.mock('../../../../routing/services/RoutingService')
jest.mock('../../../../connections/services/ConnectionService')
jest.mock('../../../../../agent/Dispatcher')

// Mock typed object
const CredentialRepositoryMock = CredentialRepository as jest.Mock<CredentialRepository>
const IndyLedgerServiceMock = IndyLedgerService as jest.Mock<IndyLedgerService>
const IndyCredentialFormatServiceMock = IndyCredentialFormatService as jest.Mock<IndyCredentialFormatService>
const DidCommMessageRepositoryMock = DidCommMessageRepository as jest.Mock<DidCommMessageRepository>
const RoutingServiceMock = RoutingService as jest.Mock<RoutingService>
const ConnectionServiceMock = ConnectionService as jest.Mock<ConnectionService>
const DispatcherMock = Dispatcher as jest.Mock<Dispatcher>

const credentialRepository = new CredentialRepositoryMock()
const didCommMessageRepository = new DidCommMessageRepositoryMock()
const routingService = new RoutingServiceMock()
const indyLedgerService = new IndyLedgerServiceMock()
const indyCredentialFormatService = new IndyCredentialFormatServiceMock()
const dispatcher = new DispatcherMock()
const connectionService = new ConnectionServiceMock()

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
indyCredentialFormatService.formatKey = 'indy'

const agentConfig = getAgentConfig('V2CredentialServiceOfferTest')
const agentContext = getAgentContext()

const connection = getMockConnection({
  id: '123',
  state: DidExchangeState.Completed,
})

const credentialPreview = V1CredentialPreview.fromRecord({
  name: 'John',
  age: '99',
})
const offerFormat = new CredentialFormatSpec({
  attachId: 'offer-attachment-id',
  format: 'hlindy/cred-abstract@v2.0',
})

const offerAttachment = new Attachment({
  id: 'offer-attachment-id',
  mimeType: 'application/json',
  data: new AttachmentData({
    base64:
      'eyJzY2hlbWFfaWQiOiJhYWEiLCJjcmVkX2RlZl9pZCI6IlRoN01wVGFSWlZSWW5QaWFiZHM4MVk6MzpDTDoxNzpUQUciLCJub25jZSI6Im5vbmNlIiwia2V5X2NvcnJlY3RuZXNzX3Byb29mIjp7fX0',
  }),
})

describe('V2CredentialServiceOffer', () => {
  let eventEmitter: EventEmitter
  let credentialService: V2CredentialService

  beforeEach(async () => {
    // real objects
    eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())

    // mock function implementations
    mockFunction(connectionService.getById).mockResolvedValue(connection)
    mockFunction(indyLedgerService.getCredentialDefinition).mockResolvedValue(credDef)
    mockFunction(indyLedgerService.getSchema).mockResolvedValue(schema)

    credentialService = new V2CredentialService(
      connectionService,
      didCommMessageRepository,
      routingService,
      dispatcher,
      eventEmitter,
      credentialRepository,
      indyCredentialFormatService,
      agentConfig.logger
    )
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('createOffer', () => {
    const offerOptions: CreateOfferOptions<[IndyCredentialFormat]> = {
      comment: 'some comment',
      connection,
      credentialFormats: {
        indy: {
          attributes: credentialPreview.attributes,
          credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
        },
      },
    }

    test(`creates credential record in ${CredentialState.OfferSent} state with offer, thread ID`, async () => {
      mockFunction(indyCredentialFormatService.supportsFormat).mockReturnValue(true)
      mockFunction(indyCredentialFormatService.createOffer).mockResolvedValue({
        attachment: offerAttachment,
        format: offerFormat,
      })

      // when
      await credentialService.createOffer(agentContext, offerOptions)

      // then
      expect(credentialRepository.save).toHaveBeenNthCalledWith(
        1,
        agentContext,
        expect.objectContaining({
          type: CredentialExchangeRecord.type,
          id: expect.any(String),
          createdAt: expect.any(Date),
          state: CredentialState.OfferSent,
          connectionId: connection.id,
        })
      )
    })

    test(`emits stateChange event with a new credential in ${CredentialState.OfferSent} state`, async () => {
      mockFunction(indyCredentialFormatService.supportsFormat).mockReturnValue(true)
      mockFunction(indyCredentialFormatService.createOffer).mockResolvedValue({
        attachment: offerAttachment,
        format: offerFormat,
      })

      const eventListenerMock = jest.fn()
      eventEmitter.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, eventListenerMock)

      await credentialService.createOffer(agentContext, offerOptions)

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'CredentialStateChanged',
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          previousState: null,
          credentialRecord: expect.objectContaining({
            state: CredentialState.OfferSent,
          }),
        },
      })
    })

    test('returns credential offer message', async () => {
      mockFunction(indyCredentialFormatService.supportsFormat).mockReturnValue(true)
      mockFunction(indyCredentialFormatService.createOffer).mockResolvedValue({
        attachment: offerAttachment,
        format: offerFormat,
        previewAttributes: credentialPreview.attributes,
      })

      const { message: credentialOffer } = await credentialService.createOffer(agentContext, offerOptions)

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
    const credentialOfferMessage = new V2OfferCredentialMessage({
      formats: [offerFormat],
      comment: 'some comment',
      credentialPreview,
      offerAttachments: [offerAttachment],
    })

    const messageContext = new InboundMessageContext(credentialOfferMessage, { agentContext, connection })

    test(`creates and return credential record in ${CredentialState.OfferReceived} state with offer, thread ID`, async () => {
      mockFunction(indyCredentialFormatService.supportsFormat).mockReturnValue(true)

      // when
      await credentialService.processOffer(messageContext)

      // then
      expect(credentialRepository.save).toHaveBeenNthCalledWith(
        1,
        agentContext,
        expect.objectContaining({
          type: CredentialExchangeRecord.type,
          id: expect.any(String),
          createdAt: expect.any(Date),
          threadId: credentialOfferMessage.id,
          connectionId: connection.id,
          state: CredentialState.OfferReceived,
        })
      )
    })

    test(`emits stateChange event with ${CredentialState.OfferReceived}`, async () => {
      mockFunction(indyCredentialFormatService.supportsFormat).mockReturnValue(true)

      const eventListenerMock = jest.fn()
      eventEmitter.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, eventListenerMock)

      // when
      await credentialService.processOffer(messageContext)

      // then
      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'CredentialStateChanged',
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          previousState: null,
          credentialRecord: expect.objectContaining({
            state: CredentialState.OfferReceived,
          }),
        },
      })
    })
  })
})
