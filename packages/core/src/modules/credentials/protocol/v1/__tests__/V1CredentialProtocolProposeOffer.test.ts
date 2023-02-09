import type { CredentialStateChangedEvent } from '../../../CredentialEvents'
import type { CreateCredentialOfferOptions, CreateCredentialProposalOptions } from '../../CredentialProtocolOptions'

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
import { schema, credDef } from '../../../__tests__/fixtures'
import { IndyCredentialFormatService } from '../../../formats'
import { CredentialFormatSpec } from '../../../models'
import { CredentialState } from '../../../models/CredentialState'
import { CredentialExchangeRecord } from '../../../repository/CredentialExchangeRecord'
import { CredentialRepository } from '../../../repository/CredentialRepository'
import { V1CredentialProtocol } from '../V1CredentialProtocol'
import { INDY_CREDENTIAL_OFFER_ATTACHMENT_ID, V1OfferCredentialMessage } from '../messages'
import { V1CredentialPreview } from '../messages/V1CredentialPreview'

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

const agentConfig = getAgentConfig('V1CredentialProtocolProposeOfferTest')
const eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())

const agentContext = getAgentContext({
  registerInstances: [
    [CredentialRepository, credentialRepository],
    [DidCommMessageRepository, didCommMessageRepository],
    [RoutingService, routingService],
    [Dispatcher, dispatcher],
    [ConnectionService, connectionService],
    [EventEmitter, eventEmitter],
  ],
  agentConfig,
})

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
indyCredentialFormatService.credentialRecordType = 'indy'

const connectionRecord = getMockConnection({
  id: '123',
  state: DidExchangeState.Completed,
})

const credentialPreview = V1CredentialPreview.fromRecord({
  name: 'John',
  age: '99',
})

const offerAttachment = new Attachment({
  id: INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
  mimeType: 'application/json',
  data: new AttachmentData({
    base64:
      'eyJzY2hlbWFfaWQiOiJhYWEiLCJjcmVkX2RlZl9pZCI6IlRoN01wVGFSWlZSWW5QaWFiZHM4MVk6MzpDTDoxNzpUQUciLCJub25jZSI6Im5vbmNlIiwia2V5X2NvcnJlY3RuZXNzX3Byb29mIjp7fX0',
  }),
})

const proposalAttachment = new Attachment({
  data: new AttachmentData({
    json: {
      cred_def_id: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
      schema_issuer_did: 'GMm4vMw8LLrLJjp81kRRLp',
      schema_name: 'ahoy',
      schema_version: '1.0',
      schema_id: 'q7ATwTYbQDgiigVijUAej:2:test:1.0',
      issuer_did: 'GMm4vMw8LLrLJjp81kRRLp',
    },
  }),
})

describe('V1CredentialProtocolProposeOffer', () => {
  let credentialProtocol: V1CredentialProtocol

  beforeEach(async () => {
    // mock function implementations
    mockFunction(connectionService.getById).mockResolvedValue(connectionRecord)
    mockFunction(indyLedgerService.getCredentialDefinition).mockResolvedValue(credDef)
    mockFunction(indyLedgerService.getSchema).mockResolvedValue(schema)

    credentialProtocol = new V1CredentialProtocol({
      indyCredentialFormat: indyCredentialFormatService,
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('createProposal', () => {
    const proposeOptions: CreateCredentialProposalOptions<[IndyCredentialFormatService]> = {
      connectionRecord: connectionRecord,
      credentialFormats: {
        indy: {
          credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
          schemaIssuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
          schemaName: 'ahoy',
          schemaVersion: '1.0',
          schemaId: 'q7ATwTYbQDgiigVijUAej:2:test:1.0',
          issuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
          attributes: credentialPreview.attributes,
        },
      },
      comment: 'v1 propose credential test',
    }

    test(`creates credential record in ${CredentialState.OfferSent} state with offer, thread id`, async () => {
      const repositorySaveSpy = jest.spyOn(credentialRepository, 'save')

      mockFunction(indyCredentialFormatService.createProposal).mockResolvedValue({
        attachment: proposalAttachment,
        format: new CredentialFormatSpec({
          format: 'indy',
          attachmentId: 'indy-proposal',
        }),
      })

      await credentialProtocol.createProposal(agentContext, proposeOptions)

      // then
      expect(repositorySaveSpy).toHaveBeenNthCalledWith(
        1,
        agentContext,
        expect.objectContaining({
          type: CredentialExchangeRecord.type,
          id: expect.any(String),
          createdAt: expect.any(Date),
          connectionId: connectionRecord.id,
          state: CredentialState.ProposalSent,
        })
      )
    })

    test(`emits stateChange event with a new credential in ${CredentialState.ProposalSent} state`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, eventListenerMock)

      mockFunction(indyCredentialFormatService.createProposal).mockResolvedValue({
        attachment: proposalAttachment,
        format: new CredentialFormatSpec({
          format: 'indy',
          attachmentId: 'indy-proposal',
        }),
      })

      await credentialProtocol.createProposal(agentContext, proposeOptions)

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'CredentialStateChanged',
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          previousState: null,
          credentialRecord: expect.objectContaining({
            state: CredentialState.ProposalSent,
          }),
        },
      })
    })

    test('returns credential proposal message', async () => {
      mockFunction(indyCredentialFormatService.createProposal).mockResolvedValue({
        attachment: proposalAttachment,
        format: new CredentialFormatSpec({
          format: 'indy',
          attachmentId: 'indy-proposal',
        }),
        previewAttributes: credentialPreview.attributes,
      })

      const { message } = await credentialProtocol.createProposal(agentContext, proposeOptions)

      expect(message.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/1.0/propose-credential',
        comment: 'v1 propose credential test',
        cred_def_id: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
        schema_issuer_did: 'GMm4vMw8LLrLJjp81kRRLp',
        schema_name: 'ahoy',
        schema_version: '1.0',
        schema_id: 'q7ATwTYbQDgiigVijUAej:2:test:1.0',
        issuer_did: 'GMm4vMw8LLrLJjp81kRRLp',
        credential_proposal: {
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
      })
    })
  })

  describe('createOffer', () => {
    const offerOptions: CreateCredentialOfferOptions<[IndyCredentialFormatService]> = {
      comment: 'some comment',
      connectionRecord,
      credentialFormats: {
        indy: {
          attributes: credentialPreview.attributes,
          credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
        },
      },
    }

    test(`creates credential record in ${CredentialState.OfferSent} state with offer, thread id`, async () => {
      mockFunction(indyCredentialFormatService.createOffer).mockResolvedValue({
        attachment: offerAttachment,
        format: new CredentialFormatSpec({
          format: 'indy',
          attachmentId: 'indy-offer',
        }),
        previewAttributes: credentialPreview.attributes,
      })

      const repositorySaveSpy = jest.spyOn(credentialRepository, 'save')

      await credentialProtocol.createOffer(agentContext, offerOptions)

      // then
      expect(repositorySaveSpy).toHaveBeenCalledTimes(1)

      const [[, createdCredentialRecord]] = repositorySaveSpy.mock.calls
      expect(createdCredentialRecord).toMatchObject({
        type: CredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        threadId: createdCredentialRecord.threadId,
        connectionId: connectionRecord.id,
        state: CredentialState.OfferSent,
      })
    })

    test(`emits stateChange event with a new credential in ${CredentialState.OfferSent} state`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, eventListenerMock)

      mockFunction(indyCredentialFormatService.createOffer).mockResolvedValue({
        attachment: offerAttachment,
        format: new CredentialFormatSpec({
          format: 'indy',
          attachmentId: 'indy-offer',
        }),
        previewAttributes: credentialPreview.attributes,
      })

      await credentialProtocol.createOffer(agentContext, offerOptions)

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

    test('throws error if preview is not returned from createProposal in indyCredentialFormatService', async () => {
      mockFunction(indyCredentialFormatService.createOffer).mockResolvedValue({
        attachment: offerAttachment,
        format: new CredentialFormatSpec({
          format: 'indy',
          attachmentId: 'indy-offer',
        }),
      })

      await expect(credentialProtocol.createOffer(agentContext, offerOptions)).rejects.toThrowError(
        'Missing required credential preview from indy format service'
      )
    })

    test('returns credential offer message', async () => {
      mockFunction(indyCredentialFormatService.createOffer).mockResolvedValue({
        attachment: offerAttachment,
        format: new CredentialFormatSpec({
          format: 'indy',
          attachmentId: 'indy-offer',
        }),
        previewAttributes: credentialPreview.attributes,
      })

      const { message: credentialOffer } = await credentialProtocol.createOffer(agentContext, offerOptions)
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
        'offers~attach': [JsonTransformer.toJSON(offerAttachment)],
      })
    })
  })

  describe('processOffer', () => {
    const credentialOfferMessage = new V1OfferCredentialMessage({
      comment: 'some comment',
      credentialPreview: credentialPreview,
      offerAttachments: [offerAttachment],
    })
    const messageContext = new InboundMessageContext(credentialOfferMessage, {
      agentContext,
      connection: connectionRecord,
    })

    test(`creates and return credential record in ${CredentialState.OfferReceived} state with offer, thread ID`, async () => {
      // when
      await credentialProtocol.processOffer(messageContext)

      // then
      expect(credentialRepository.save).toHaveBeenNthCalledWith(
        1,
        agentContext,
        expect.objectContaining({
          type: CredentialExchangeRecord.type,
          id: expect.any(String),
          createdAt: expect.any(Date),
          threadId: credentialOfferMessage.id,
          connectionId: connectionRecord.id,
          state: CredentialState.OfferReceived,
          credentialAttributes: undefined,
        })
      )
    })

    test(`emits stateChange event with ${CredentialState.OfferReceived}`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, eventListenerMock)

      // when
      await credentialProtocol.processOffer(messageContext)

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
