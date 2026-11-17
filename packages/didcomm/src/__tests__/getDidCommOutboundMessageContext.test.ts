import { Subject } from 'rxjs'
import type { MockedClassConstructor } from '../../../../tests/types'
import { DidKey, EventEmitter, Kms, RecordNotFoundError, TypedArrayEncoder } from '../../../core/src'
import { getAgentConfig, getAgentContext, getMockOutOfBand, mockFunction } from '../../../core/tests/helpers'
import { TestMessage } from '../../../core/tests/TestMessage'
import { DidCommModuleConfig } from '../DidCommModuleConfig'
import { ServiceDecorator } from '../decorators/service/ServiceDecorator'
import { getConnectionlessOutboundMessageContext } from '../getDidCommOutboundMessageContext'
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
    invitationInlineServiceKeys: [{ recipientKeyFingerprint: ourPublicJwk.fingerprint, kmsKeyId: 'our-kms-key-id' }],
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

  test('sets the sender key id from the out of band record tagged with our key for a message on a new thread', async () => {
    mockFunction(outOfBandRepository.findSingleByQuery).mockResolvedValue(null)
    mockFunction(outOfBandRepository.findByQuery).mockResolvedValue([senderOutOfBandRecord])

    const outboundMessageContext = await getConnectionlessOutboundMessageContext(agentContext, {
      ...getMessages(),
      message: new TestMessage(),
      associatedRecord: senderOutOfBandRecord,
    })

    expect(outboundMessageContext.serviceParams?.senderKey.keyId).toEqual('our-kms-key-id')
    expect(outOfBandRepository.findByQuery).toHaveBeenCalledWith(agentContext, {
      role: DidCommOutOfBandRole.Sender,
      recipientKeyFingerprints: [ourPublicJwk.fingerprint],
    })
  })

  test('prefers the out of band record with our key inline when several records are tagged with our key', async () => {
    mockFunction(outOfBandRepository.findSingleByQuery).mockResolvedValue(null)
    mockFunction(outOfBandRepository.findByQuery).mockResolvedValue([didOutOfBandRecord, senderOutOfBandRecord])

    const outboundMessageContext = await getConnectionlessOutboundMessageContext(agentContext, {
      ...getMessages(),
      message: new TestMessage(),
      associatedRecord: senderOutOfBandRecord,
    })

    expect(outboundMessageContext.serviceParams?.senderKey.keyId).toEqual('our-kms-key-id')
    expect(didCommDocumentService.resolveCreatedDidDocumentWithKeysByRecipientKey).not.toHaveBeenCalled()
    expect(didCommDocumentService.resolveServicesFromDid).not.toHaveBeenCalled()
  })

  test('sets the sender key id from our did record for an invitation created with invitationDid', async () => {
    mockFunction(didCommDocumentService.resolveCreatedDidDocumentWithKeysByRecipientKey).mockResolvedValue({
      didDocument: ourDidKey.didDocument,
      keys: [{ didDocumentRelativeKeyId: `#${ourPublicJwk.fingerprint}`, kmsKeyId: 'our-did-kms-key-id' }],
    })
    mockFunction(outOfBandRepository.findSingleByQuery).mockResolvedValue(null)
    mockFunction(outOfBandRepository.findByQuery).mockResolvedValue([didOutOfBandRecord])

    const outboundMessageContext = await getConnectionlessOutboundMessageContext(agentContext, {
      ...getMessages(),
      message: new TestMessage(),
      associatedRecord: didOutOfBandRecord,
    })

    expect(outboundMessageContext.serviceParams?.senderKey.keyId).toEqual('our-did-kms-key-id')
    expect(didCommDocumentService.resolveServicesFromDid).not.toHaveBeenCalled()
  })

  test('sets the legacy key id for an invitationDid key created before kms key ids', async () => {
    mockFunction(didCommDocumentService.resolveCreatedDidDocumentWithKeysByRecipientKey).mockResolvedValue({
      didDocument: ourDidKey.didDocument,
      keys: [],
    })
    mockFunction(outOfBandRepository.findSingleByQuery).mockResolvedValue(null)
    mockFunction(outOfBandRepository.findByQuery).mockResolvedValue([didOutOfBandRecord])

    const outboundMessageContext = await getConnectionlessOutboundMessageContext(agentContext, {
      ...getMessages(),
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
    expect(outOfBandRepository.findByQuery).not.toHaveBeenCalled()
  })
})
