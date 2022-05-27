import type { AgentConfig } from '../../../agent/AgentConfig'
import type { ConnectionService } from '../../connections/services/ConnectionService'
import type { DidRepository } from '../../dids/repository'
import type { CredentialStateChangedEvent } from '../CredentialEvents'
import type { ServiceOfferCredentialOptions } from '../CredentialServiceOptions'
import type { ProposeCredentialOptions } from '../CredentialsModuleOptions'

import { Agent } from '../../../../src/agent/Agent'
import { Dispatcher } from '../../../../src/agent/Dispatcher'
import { DidCommMessageRepository } from '../../../../src/storage'
import { getAgentConfig, getBaseConfig, getMockConnection, mockFunction } from '../../../../tests/helpers'
import { EventEmitter } from '../../../agent/EventEmitter'
import { MessageSender } from '../../../agent/MessageSender'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { Attachment, AttachmentData } from '../../../decorators/attachment/Attachment'
import { DidExchangeState } from '../../connections'
import { DidResolverService } from '../../dids'
import { IndyHolderService } from '../../indy/services/IndyHolderService'
import { IndyIssuerService } from '../../indy/services/IndyIssuerService'
import { IndyLedgerService } from '../../ledger/services'
import { MediationRecipientService } from '../../routing/services/MediationRecipientService'
import { CredentialEventTypes } from '../CredentialEvents'
import { CredentialProtocolVersion } from '../CredentialProtocolVersion'
import { CredentialState } from '../CredentialState'
import { IndyCredentialFormatService } from '../formats'
import { V1CredentialPreview } from '../protocol/v1/V1CredentialPreview'
import { V1CredentialService } from '../protocol/v1/V1CredentialService'
import { INDY_CREDENTIAL_OFFER_ATTACHMENT_ID, V1OfferCredentialMessage } from '../protocol/v1/messages'
import { CredentialExchangeRecord } from '../repository/CredentialExchangeRecord'
import { CredentialRepository } from '../repository/CredentialRepository'
import { RevocationService } from '../services'

import { schema, credDef } from './fixtures'

// Mock classes
jest.mock('../repository/CredentialRepository')
jest.mock('../../../../src/storage/didcomm/DidCommMessageRepository')
jest.mock('../../../modules/ledger/services/IndyLedgerService')
jest.mock('../../indy/services/IndyHolderService')
jest.mock('../../indy/services/IndyIssuerService')
jest.mock('../../routing/services/MediationRecipientService')

// Mock typed object
const CredentialRepositoryMock = CredentialRepository as jest.Mock<CredentialRepository>
const IndyLedgerServiceMock = IndyLedgerService as jest.Mock<IndyLedgerService>
const IndyHolderServiceMock = IndyHolderService as jest.Mock<IndyHolderService>
const IndyIssuerServiceMock = IndyIssuerService as jest.Mock<IndyIssuerService>
const DidCommMessageRepositoryMock = DidCommMessageRepository as jest.Mock<DidCommMessageRepository>
const MessageSenderMock = MessageSender as jest.Mock<MessageSender>
const MediationRecipientServiceMock = MediationRecipientService as jest.Mock<MediationRecipientService>

const connection = getMockConnection({
  id: '123',
  state: DidExchangeState.Completed,
})

const credentialPreview = V1CredentialPreview.fromRecord({
  name: 'John',
  age: '99',
})

const badCredentialPreview = V1CredentialPreview.fromRecord({
  test: 'credential',
  error: 'yes',
})
const offerAttachment = new Attachment({
  id: INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
  mimeType: 'application/json',
  data: new AttachmentData({
    base64:
      'eyJzY2hlbWFfaWQiOiJhYWEiLCJjcmVkX2RlZl9pZCI6IlRoN01wVGFSWlZSWW5QaWFiZHM4MVk6MzpDTDoxNzpUQUciLCJub25jZSI6Im5vbmNlIiwia2V5X2NvcnJlY3RuZXNzX3Byb29mIjp7fX0',
  }),
})

const { config, agentDependencies: dependencies } = getBaseConfig('Agent Class Test V1 Cred')

describe('CredentialService', () => {
  let agent: Agent
  let credentialRepository: CredentialRepository
  let indyLedgerService: IndyLedgerService
  let indyIssuerService: IndyIssuerService
  let indyHolderService: IndyHolderService
  let eventEmitter: EventEmitter
  let didCommMessageRepository: DidCommMessageRepository
  let mediationRecipientService: MediationRecipientService
  let messageSender: MessageSender
  let agentConfig: AgentConfig

  let dispatcher: Dispatcher
  let credentialService: V1CredentialService
  let revocationService: RevocationService
  let didResolverService: DidResolverService
  let didRepository: DidRepository

  beforeEach(async () => {
    credentialRepository = new CredentialRepositoryMock()
    indyIssuerService = new IndyIssuerServiceMock()
    didCommMessageRepository = new DidCommMessageRepositoryMock()
    messageSender = new MessageSenderMock()
    mediationRecipientService = new MediationRecipientServiceMock()
    indyHolderService = new IndyHolderServiceMock()
    indyLedgerService = new IndyLedgerServiceMock()
    mockFunction(indyLedgerService.getCredentialDefinition).mockReturnValue(Promise.resolve(credDef))
    agentConfig = getAgentConfig('CredentialServiceTest')
    eventEmitter = new EventEmitter(agentConfig)

    dispatcher = new Dispatcher(messageSender, eventEmitter, agentConfig)
    revocationService = new RevocationService(credentialRepository, eventEmitter, agentConfig)
    didResolverService = new DidResolverService(agentConfig, indyLedgerService, didRepository)

    credentialService = new V1CredentialService(
      {
        getById: () => Promise.resolve(connection),
        assertConnectionOrServiceDecorator: () => true,
      } as unknown as ConnectionService,
      didCommMessageRepository,
      agentConfig,
      mediationRecipientService,
      dispatcher,
      eventEmitter,
      credentialRepository,
      new IndyCredentialFormatService(
        credentialRepository,
        eventEmitter,
        indyIssuerService,
        indyLedgerService,
        indyHolderService,
        agentConfig
      ),
      revocationService,
      didResolverService
    )
    mockFunction(indyLedgerService.getSchema).mockReturnValue(Promise.resolve(schema))
  })

  describe('createCredentialProposal', () => {
    let proposeOptions: ProposeCredentialOptions
    const credPropose = {
      credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
      schemaIssuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
      schemaName: 'ahoy',
      schemaVersion: '1.0',
      schemaId: 'q7ATwTYbQDgiigVijUAej:2:test:1.0',
      issuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
    }

    beforeEach(async () => {
      proposeOptions = {
        connectionId: connection.id,
        protocolVersion: CredentialProtocolVersion.V1,
        credentialFormats: {
          indy: {
            payload: credPropose,
            attributes: credentialPreview.attributes,
          },
        },
        comment: 'v1 propose credential test',
      }
    })

    test(`creates credential record in ${CredentialState.OfferSent} state with offer, thread ID`, async () => {
      const repositorySaveSpy = jest.spyOn(credentialRepository, 'save')

      await credentialService.createProposal(proposeOptions)

      // then
      expect(repositorySaveSpy).toHaveBeenCalledTimes(1)

      const [[createdCredentialRecord]] = repositorySaveSpy.mock.calls
      expect(createdCredentialRecord).toMatchObject({
        type: CredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        threadId: createdCredentialRecord.threadId,
        connectionId: connection.id,
        state: CredentialState.ProposalSent,
      })
    })

    test(`emits stateChange event with a new credential in ${CredentialState.ProposalSent} state`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, eventListenerMock)

      await credentialService.createProposal(proposeOptions)

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'CredentialStateChanged',
        payload: {
          previousState: null,
          credentialRecord: expect.objectContaining({
            state: CredentialState.ProposalSent,
          }),
        },
      })
    })

    test('returns credential proposal message', async () => {
      const { message: credentialProposal } = await credentialService.createProposal(proposeOptions)

      expect(credentialProposal.toJSON()).toMatchObject({
        '@id': expect.any(String),
        '@type': 'https://didcomm.org/issue-credential/1.0/propose-credential',
        comment: 'v1 propose credential test',
        schema_id: 'q7ATwTYbQDgiigVijUAej:2:test:1.0',
        schema_name: 'ahoy',
        schema_version: '1.0',
        cred_def_id: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
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

  describe('createCredentialOffer', () => {
    let offerOptions: ServiceOfferCredentialOptions

    beforeEach(async () => {
      offerOptions = {
        comment: 'some comment',
        connection,
        connectionId: connection.id,
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
          },
        },
        protocolVersion: CredentialProtocolVersion.V1,
      }
    })

    test(`creates credential record in ${CredentialState.OfferSent} state with offer, thread ID`, async () => {
      const repositorySaveSpy = jest.spyOn(credentialRepository, 'save')

      await credentialService.createOffer(offerOptions)

      // then
      expect(repositorySaveSpy).toHaveBeenCalledTimes(1)

      const [[createdCredentialRecord]] = repositorySaveSpy.mock.calls
      expect(createdCredentialRecord).toMatchObject({
        type: CredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        threadId: createdCredentialRecord.threadId,
        connectionId: connection.id,
        state: CredentialState.OfferSent,
      })
    })

    test(`emits stateChange event with a new credential in ${CredentialState.OfferSent} state`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, eventListenerMock)

      await credentialService.createOffer(offerOptions)

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'CredentialStateChanged',
        payload: {
          previousState: null,
          credentialRecord: expect.objectContaining({
            state: CredentialState.OfferSent,
          }),
        },
      })
    })

    test('returns credential offer message', async () => {
      const { message: credentialOffer } = await credentialService.createOffer(offerOptions)
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

    test('throw error if credential preview attributes do not match with schema attributes', async () => {
      offerOptions = {
        ...offerOptions,
        credentialFormats: {
          indy: {
            attributes: badCredentialPreview.attributes,
            credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
          },
        },
      }
      expect(credentialService.createOffer(offerOptions)).rejects.toThrowError(
        `The credential preview attributes do not match the schema attributes (difference is: test,error,name,age, needs: name,age)`
      )
      const credentialPreviewWithExtra = V1CredentialPreview.fromRecord({
        test: 'credential',
        error: 'yes',
        name: 'John',
        age: '99',
      })

      offerOptions = {
        ...offerOptions,
        credentialFormats: {
          indy: {
            attributes: credentialPreviewWithExtra.attributes,
            credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
          },
        },
      }
      expect(credentialService.createOffer(offerOptions)).rejects.toThrowError(
        `The credential preview attributes do not match the schema attributes (difference is: test,error, needs: name,age)`
      )
    })
  })

  describe('processCredentialOffer', () => {
    let messageContext: InboundMessageContext<V1OfferCredentialMessage>
    let credentialOfferMessage: V1OfferCredentialMessage

    beforeEach(async () => {
      credentialOfferMessage = new V1OfferCredentialMessage({
        comment: 'some comment',
        credentialPreview: credentialPreview,
        offerAttachments: [offerAttachment],
      })
      messageContext = new InboundMessageContext(credentialOfferMessage, {
        connection,
      })
      messageContext.connection = connection
    })

    test(`creates and return credential record in ${CredentialState.OfferReceived} state with offer, thread ID`, async () => {
      const repositorySaveSpy = jest.spyOn(credentialRepository, 'save')
      agent = new Agent(config, dependencies)
      await agent.initialize()
      expect(agent.isInitialized).toBe(true)
      const agentConfig = getAgentConfig('CredentialServiceTest')
      eventEmitter = new EventEmitter(agentConfig)

      const dispatcher = agent.injectionContainer.resolve<Dispatcher>(Dispatcher)
      const mediationRecipientService = agent.injectionContainer.resolve(MediationRecipientService)

      credentialService = new V1CredentialService(
        {
          getById: () => Promise.resolve(connection),
          assertConnectionOrServiceDecorator: () => true,
        } as unknown as ConnectionService,
        didCommMessageRepository,
        agentConfig,
        mediationRecipientService,
        dispatcher,
        eventEmitter,
        credentialRepository,
        new IndyCredentialFormatService(
          credentialRepository,
          eventEmitter,
          indyIssuerService,
          indyLedgerService,
          indyHolderService,
          agentConfig
        ),
        revocationService,
        didResolverService
      )
      // when
      const returnedCredentialRecord = await credentialService.processOffer(messageContext)

      // then
      const expectedCredentialRecord = {
        type: CredentialExchangeRecord.type,
        id: expect.any(String),
        createdAt: expect.any(Date),
        threadId: credentialOfferMessage.id,
        connectionId: connection.id,
        state: CredentialState.OfferReceived,
      }
      expect(repositorySaveSpy).toHaveBeenCalledTimes(1)
      const [[createdCredentialRecord]] = repositorySaveSpy.mock.calls
      expect(createdCredentialRecord).toMatchObject(expectedCredentialRecord)
      expect(returnedCredentialRecord).toMatchObject(expectedCredentialRecord)
    })

    test(`emits stateChange event with ${CredentialState.OfferReceived}`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, eventListenerMock)

      // when
      await credentialService.processOffer(messageContext)

      // then
      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'CredentialStateChanged',
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
