import { Subject } from 'rxjs'
import type { MockedClassConstructor } from '../../../../tests/types'
import { DidKey, EventEmitter, Kms, RecordNotFoundError, TypedArrayEncoder } from '../../../core/src'
import { getAgentConfig, getAgentContext, getMockOutOfBand, mockFunction } from '../../../core/tests/helpers'
import { TestMessage } from '../../../core/tests/TestMessage'
import { DidCommMessage } from '../DidCommMessage'
import { DidCommModuleConfig } from '../DidCommModuleConfig'
import { ServiceDecorator } from '../decorators/service/ServiceDecorator'
import {
  getConnectionlessOutboundMessageContext,
  getOutboundDidCommMessageContext,
} from '../getDidCommOutboundMessageContext'
import { DidCommCredentialExchangeRecord, DidCommCredentialRole, DidCommCredentialState } from '../modules/credentials'
import {
  DidCommOutOfBandInvitation,
  DidCommOutOfBandRole,
  DidCommOutOfBandService,
  DidCommOutOfBandState,
} from '../modules/oob'
import { DidCommOutOfBandRecord } from '../modules/oob/repository'
import { DidCommOutOfBandRepository } from '../modules/oob/repository/DidCommOutOfBandRepository'
import { DidCommMessageRepository } from '../repository/DidCommMessageRepository'
import { DidCommDocumentService } from '../services/DidCommDocumentService'

vi.mock('../modules/oob/repository/DidCommOutOfBandRepository')
vi.mock('../repository/DidCommMessageRepository')
vi.mock('../services/DidCommDocumentService')

const OutOfBandRepositoryMock = DidCommOutOfBandRepository as MockedClassConstructor<typeof DidCommOutOfBandRepository>
const DidCommDocumentServiceMock = DidCommDocumentService as MockedClassConstructor<typeof DidCommDocumentService>
const MessageRepositoryMock = DidCommMessageRepository as MockedClassConstructor<typeof DidCommMessageRepository>

const ourVerkey = 'ByHnpUCFb1vAfh9CFZ8ZkmUZguURW8nSw889hy6rD8L7'
const theirVerkey = 'GjZWsBLgZCR18aL468JAT7w9CZRiBnpxUPPgyQxh4voa'
const ourPublicJwk = Kms.PublicJwk.fromPublicKey({
  kty: 'OKP',
  crv: 'Ed25519',
  publicKey: TypedArrayEncoder.fromBase58(ourVerkey),
})

describe('getConnectionlessOutboundMessageContext', () => {
  const agentConfig = getAgentConfig('getConnectionlessOutboundMessageContext')
  const outOfBandRepository = new OutOfBandRepositoryMock()
  const didCommDocumentService = new DidCommDocumentServiceMock()
  const agentContext = getAgentContext({
    agentConfig,
    registerInstances: [
      [DidCommModuleConfig, new DidCommModuleConfig()],
      [DidCommOutOfBandRepository, outOfBandRepository],
      [
        DidCommOutOfBandService,
        new DidCommOutOfBandService(
          outOfBandRepository,
          new EventEmitter(agentConfig.agentDependencies, new Subject()),
          didCommDocumentService
        ),
      ],
      [DidCommMessageRepository, new MessageRepositoryMock()],
      [DidCommDocumentService, didCommDocumentService],
    ],
  })

  const senderOutOfBandRecord = getMockOutOfBand({
    role: DidCommOutOfBandRole.Sender,
    state: DidCommOutOfBandState.AwaitResponse,
    recipientKeys: [new DidKey(ourPublicJwk).did],
    invitationInlineServiceKeys: [
      { recipientKeyFingerprint: ourPublicJwk.fingerprint, kmsKeyId: 'our-kms-key-id', kmsBackend: 'askar' },
    ],
  })

  const ourDidKey = new DidKey(ourPublicJwk)
  const didOutOfBandRecord = new DidCommOutOfBandRecord({
    role: DidCommOutOfBandRole.Sender,
    state: DidCommOutOfBandState.AwaitResponse,
    outOfBandInvitation: new DidCommOutOfBandInvitation({ label: 'label', services: [ourDidKey.did] }),
    tags: { recipientKeyFingerprints: [ourPublicJwk.fingerprint] },
  })

  const getMessages = () => {
    const lastSentMessage = new TestMessage()
    lastSentMessage.service = new ServiceDecorator({ recipientKeys: [ourVerkey], serviceEndpoint: 'https://issuer' })
    const lastReceivedMessage = new TestMessage()
    lastReceivedMessage.service = new ServiceDecorator({
      recipientKeys: [theirVerkey],
      serviceEndpoint: 'https://holder',
    })

    return { lastSentMessage, lastReceivedMessage }
  }

  beforeEach(() => {
    mockFunction(didCommDocumentService.resolveCreatedDidDocumentWithKeysByRecipientKey).mockRejectedValue(
      new RecordNotFoundError('Created did not found', { recordType: 'DidRecord' })
    )
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // A message on a new thread, such as a revocation notification, finds the out of band record by the exchange thread
  const getMessagesForExchange = (outOfBandRecord: DidCommOutOfBandRecord) => {
    const messages = getMessages()
    mockFunction(outOfBandRepository.findSingleByQuery).mockImplementation(async (_, query) =>
      'invitationRequestsThreadIds' in query &&
      query.invitationRequestsThreadIds?.includes(messages.lastReceivedMessage.threadId)
        ? outOfBandRecord
        : null
    )
    return messages
  }

  test('sets the sender key id from the out of band record of the exchange for a message on a new thread', async () => {
    const messages = getMessagesForExchange(senderOutOfBandRecord)

    const outboundMessageContext = await getConnectionlessOutboundMessageContext(agentContext, {
      ...messages,
      message: new TestMessage(),
      associatedRecord: senderOutOfBandRecord,
    })

    expect(outboundMessageContext.serviceParams?.senderKey.keyId).toEqual('our-kms-key-id')
    expect(outboundMessageContext.serviceParams?.senderKey.kmsBackend).toEqual('askar')
    expect(outOfBandRepository.findSingleByQuery).toHaveBeenCalledWith(agentContext, {
      invitationRequestsThreadIds: [messages.lastReceivedMessage.threadId],
    })
    expect(didCommDocumentService.resolveCreatedDidDocumentWithKeysByRecipientKey).not.toHaveBeenCalled()
    expect(didCommDocumentService.resolveServicesFromDid).not.toHaveBeenCalled()
  })

  test('sets the sender key id from our did record for an invitation created with invitationDid', async () => {
    mockFunction(didCommDocumentService.resolveCreatedDidDocumentWithKeysByRecipientKey).mockResolvedValue({
      didDocument: ourDidKey.didDocument,
      keys: [
        {
          didDocumentRelativeKeyId: `#${ourPublicJwk.fingerprint}`,
          kmsKeyId: 'our-did-kms-key-id',
          kmsBackend: 'askar',
        },
      ],
    })

    const outboundMessageContext = await getConnectionlessOutboundMessageContext(agentContext, {
      ...getMessagesForExchange(didOutOfBandRecord),
      message: new TestMessage(),
      associatedRecord: didOutOfBandRecord,
    })

    expect(outboundMessageContext.serviceParams?.senderKey.keyId).toEqual('our-did-kms-key-id')
    expect(outboundMessageContext.serviceParams?.senderKey.kmsBackend).toEqual('askar')
    expect(didCommDocumentService.resolveServicesFromDid).not.toHaveBeenCalled()
  })

  test('sets the legacy key id for an invitationDid key created before kms key ids', async () => {
    mockFunction(didCommDocumentService.resolveCreatedDidDocumentWithKeysByRecipientKey).mockResolvedValue({
      didDocument: ourDidKey.didDocument,
      keys: [],
    })

    const outboundMessageContext = await getConnectionlessOutboundMessageContext(agentContext, {
      ...getMessagesForExchange(didOutOfBandRecord),
      message: new TestMessage(),
      associatedRecord: didOutOfBandRecord,
    })

    expect(outboundMessageContext.serviceParams?.senderKey.keyId).toEqual(ourPublicJwk.legacyKeyId)
  })

  test('sets the sender key id from the thread out of band record when our service is from the last sent message', async () => {
    mockFunction(outOfBandRepository.findSingleByQuery).mockImplementation(async (_, query) =>
      'invitationRequestsThreadIds' in query ? senderOutOfBandRecord : null
    )

    const outboundMessageContext = await getConnectionlessOutboundMessageContext(agentContext, {
      ...getMessages(),
      message: new TestMessage(),
      associatedRecord: senderOutOfBandRecord,
    })

    expect(outboundMessageContext.serviceParams?.senderKey.keyId).toEqual('our-kms-key-id')
  })
})

describe('getOutboundDidCommMessageContext', () => {
  test('throws for a connection-less exchange without an out of band record', async () => {
    const agentContext = getAgentContext({
      registerInstances: [
        [
          DidCommOutOfBandRepository,
          { findSingleByQuery: vi.fn().mockResolvedValue(null) } as unknown as DidCommOutOfBandRepository,
        ],
      ],
    })
    const lastReceivedMessage = new DidCommMessage()
    const message = new DidCommMessage()
    message.setThread({ threadId: lastReceivedMessage.threadId })

    await expect(
      getOutboundDidCommMessageContext(agentContext, {
        message,
        lastReceivedMessage,
        associatedRecord: new DidCommCredentialExchangeRecord({
          protocolVersion: 'v2',
          role: DidCommCredentialRole.Issuer,
          state: DidCommCredentialState.RequestReceived,
          threadId: lastReceivedMessage.threadId,
        }),
      })
    ).rejects.toThrow('No out of band record found for connection-less exchange')
  })
})
