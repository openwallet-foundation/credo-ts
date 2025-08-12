import type { CredentialProtocolOptions, DidCommCredentialStateChangedEvent } from '@credo-ts/didcomm'

import { EventEmitter, JsonTransformer } from '@credo-ts/core'
import {
  Attachment,
  AttachmentData,
  DidCommCredentialEventTypes,
  DidCommCredentialExchangeRecord,
  DidCommCredentialFormatSpec,
  DidCommCredentialState,
  DidCommDidExchangeState,
  InboundDidCommMessageContext,
} from '@credo-ts/didcomm'
import { Subject } from 'rxjs'

import { getAgentConfig, getAgentContext, getMockConnection, mockFunction } from '../../../../../../core/tests/helpers'
import { DidCommConnectionService } from '../../../../../../didcomm/src/modules/connections/services/DidCommConnectionService'
import { DidCommCredentialExchangeRepository } from '../../../../../../didcomm/src/modules/credentials/repository/DidCommCredentialExchangeRepository'
import { DidCommMessageRepository } from '../../../../../../didcomm/src/repository/DidCommMessageRepository'
import { LegacyIndyCredentialFormatService } from '../../../../formats/LegacyIndyCredentialFormatService'
import { V1CredentialProtocol } from '../V1DidCommCredentialProtocol'
import { INDY_CREDENTIAL_OFFER_ATTACHMENT_ID, V1CredentialPreview, V1OfferCredentialMessage } from '../messages'

// Mock classes
jest.mock('../../../../../../didcomm/src/modules/credentials/repository/DidCommCredentialExchangeRepository')
jest.mock('../../../../formats/LegacyIndyCredentialFormatService')
jest.mock('../../../../../../didcomm/src/repository/DidCommMessageRepository')
jest.mock('../../../../../../didcomm/src/modules/connections/services/DidCommConnectionService')

// Mock typed object
const CredentialRepositoryMock = DidCommCredentialExchangeRepository as jest.Mock<DidCommCredentialExchangeRepository>
const DidCommMessageRepositoryMock = DidCommMessageRepository as jest.Mock<DidCommMessageRepository>
const ConnectionServiceMock = DidCommConnectionService as jest.Mock<DidCommConnectionService>
const LegacyIndyCredentialFormatServiceMock =
  LegacyIndyCredentialFormatService as jest.Mock<LegacyIndyCredentialFormatService>

const credentialRepository = new CredentialRepositoryMock()
const didCommMessageRepository = new DidCommMessageRepositoryMock()
const connectionService = new ConnectionServiceMock()
const indyCredentialFormatService = new LegacyIndyCredentialFormatServiceMock()

const agentConfig = getAgentConfig('V1CredentialProtocolProposeOfferTest')
const eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())

const agentContext = getAgentContext({
  registerInstances: [
    [DidCommCredentialExchangeRepository, credentialRepository],
    [DidCommMessageRepository, didCommMessageRepository],
    [DidCommConnectionService, connectionService],
    [EventEmitter, eventEmitter],
  ],
  agentConfig,
})

// @ts-ignore
indyCredentialFormatService.credentialRecordType = 'w3c'

const connectionRecord = getMockConnection({
  id: '123',
  state: DidCommDidExchangeState.Completed,
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

    credentialProtocol = new V1CredentialProtocol({
      indyCredentialFormat: indyCredentialFormatService,
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('createProposal', () => {
    const proposeOptions: CredentialProtocolOptions.CreateCredentialProposalOptions<
      [LegacyIndyCredentialFormatService]
    > = {
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

    test(`creates credential record in ${DidCommCredentialState.OfferSent} state with offer, thread id`, async () => {
      const repositorySaveSpy = jest.spyOn(credentialRepository, 'save')

      mockFunction(indyCredentialFormatService.createProposal).mockResolvedValue({
        attachment: proposalAttachment,
        format: new DidCommCredentialFormatSpec({
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
          type: DidCommCredentialExchangeRecord.type,
          id: expect.any(String),
          createdAt: expect.any(Date),
          connectionId: connectionRecord.id,
          state: DidCommCredentialState.ProposalSent,
        })
      )
    })

    test(`emits stateChange event with a new credential in ${DidCommCredentialState.ProposalSent} state`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<DidCommCredentialStateChangedEvent>(DidCommCredentialEventTypes.DidCommCredentialStateChanged, eventListenerMock)

      mockFunction(indyCredentialFormatService.createProposal).mockResolvedValue({
        attachment: proposalAttachment,
        format: new DidCommCredentialFormatSpec({
          format: 'indy',
          attachmentId: 'indy-proposal',
        }),
      })

      await credentialProtocol.createProposal(agentContext, proposeOptions)

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'DidCommCredentialStateChanged',
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          previousState: null,
          credentialExchangeRecord: expect.objectContaining({
            state: DidCommCredentialState.ProposalSent,
          }),
        },
      })
    })

    test('returns credential proposal message', async () => {
      mockFunction(indyCredentialFormatService.createProposal).mockResolvedValue({
        attachment: proposalAttachment,
        format: new DidCommCredentialFormatSpec({
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
    const offerOptions: CredentialProtocolOptions.CreateCredentialOfferOptions<[LegacyIndyCredentialFormatService]> = {
      comment: 'some comment',
      connectionRecord,
      credentialFormats: {
        indy: {
          attributes: credentialPreview.attributes,
          credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
        },
      },
    }

    test(`creates credential record in ${DidCommCredentialState.OfferSent} state with offer, thread id`, async () => {
      mockFunction(indyCredentialFormatService.createOffer).mockResolvedValue({
        attachment: offerAttachment,
        format: new DidCommCredentialFormatSpec({
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
        type: DidCommCredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        threadId: createdCredentialRecord.threadId,
        connectionId: connectionRecord.id,
        state: DidCommCredentialState.OfferSent,
      })
    })

    test(`emits stateChange event with a new credential in ${DidCommCredentialState.OfferSent} state`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<DidCommCredentialStateChangedEvent>(DidCommCredentialEventTypes.DidCommCredentialStateChanged, eventListenerMock)

      mockFunction(indyCredentialFormatService.createOffer).mockResolvedValue({
        attachment: offerAttachment,
        format: new DidCommCredentialFormatSpec({
          format: 'indy',
          attachmentId: 'indy-offer',
        }),
        previewAttributes: credentialPreview.attributes,
      })

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

    test('throws error if preview is not returned from createProposal in indyCredentialFormatService', async () => {
      mockFunction(indyCredentialFormatService.createOffer).mockResolvedValue({
        attachment: offerAttachment,
        format: new DidCommCredentialFormatSpec({
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
        format: new DidCommCredentialFormatSpec({
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
    const messageContext = new InboundDidCommMessageContext(credentialOfferMessage, {
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
          credentialAttributes: undefined,
        })
      )
    })

    test(`emits stateChange event with ${DidCommCredentialState.OfferReceived}`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<DidCommCredentialStateChangedEvent>(DidCommCredentialEventTypes.DidCommCredentialStateChanged, eventListenerMock)

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
